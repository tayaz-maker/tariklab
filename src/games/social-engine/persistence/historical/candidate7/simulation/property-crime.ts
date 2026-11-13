import type { Command, CommandResult, Crime, WorldState } from "../domain/types.ts";
import { ITEMS } from "../domain/content.ts";
import { hasLineOfSight, isWalkable } from "../domain/world.ts";
import { adjustRelation, emit, notify } from "./events.ts";
import { INVENTORY_SLOT_LIMIT } from "./progression.ts";
import { serviceOpen } from "./services.ts";

const fail = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const source = (id: string) => "stolen:" + id;

export function propertyCommand(s: WorldState, c: Command): CommandResult | null {
  if (c.type !== "TAKE_STOCK" && c.type !== "RETURN_STOCK") return null;
  const shop = s.businesses.find((b) => b.id === c.args.businessId);
  if (!shop || s.player.location.scene !== shop.buildingId || !serviceOpen(s, shop))
    return fail("Önce açık dükkânın içine gir.");
  if (c.type === "RETURN_STOCK") {
    const crime = s.crimes.find((v) => v.id === c.args.crimeId && v.offender === "player");
    const loss = crime?.propertyLoss;
    if (!crime || !loss || loss.returnedTick !== null || loss.businessId !== shop.id)
      return fail("Bu dükkâna ait açık bir eşya kaydı bulunamadı.");
    const units = s.progression.items[loss.kind];
    const index =
      units?.findIndex((v) => v.id === loss.itemId && v.sourceId === source(crime.id)) ?? -1;
    if (index < 0 || !(s.player.inventory[loss.kind] > 0))
      return fail("Aldığın eşyanın kendisi artık çantanda değil.");
    units.splice(index, 1);
    if (--s.player.inventory[loss.kind] === 0) {
      delete s.player.inventory[loss.kind];
      delete s.progression.items[loss.kind];
    }
    shop.stock[loss.kind]++;
    loss.returnedTick = s.tick;
    const text = ITEMS[loss.kind].name + " dükkânın stoğuna geri kondu. Olay kaydı silinmedi.";
    const event = emit(s, "property_returned", text, ["player"], crime.id, "private");
    notify(s, text);
    return { ok: true, reason: text, events: [event.id] };
  }
  const kind = typeof c.args.item === "string" ? c.args.item : "";
  if (
    !Object.hasOwn(ITEMS, kind) ||
    !Object.hasOwn(shop.stock, kind) ||
    !(shop.stock[kind] >= 1) ||
    (c.args.quantity !== undefined && c.args.quantity !== 1)
  )
    return fail("Rafta bulunan tek bir ürünü seç.");
  if (shop.ownerId === "player" || !s.npcs.some((n) => n.id === shop.ownerId && n.alive))
    return fail("Başka bir esnafa ait ürün seçmelisin.");
  if (s.player.shift || s.player.vehicleId || s.mobility.trip)
    return fail("Vardiya veya yolculuk sırasında bu eylemi yapamazsın.");
  const carried = Object.entries(s.player.inventory);
  if (
    (!s.player.inventory[kind] &&
      carried.filter(([, q]) => q > 0).length >= INVENTORY_SLOT_LIMIT) ||
    carried.reduce((kg, [k, n]) => kg + (ITEMS[k]?.weight ?? 1) * n, 0) + ITEMS[kind].weight > 30
  )
    return fail("Çantanda bu ürün için yer yok.");
  const value = shop.prices[kind];
  if (!Number.isSafeInteger(value) || value <= 0) return fail("Ürünün geçerli bir stok kaydı yok.");
  const id = "crime:" + s.nextId++,
    itemId = "item:" + s.nextId++;
  const location = { ...s.player.location };
  const witnesses = s.npcs
    .filter(
      (n) =>
        n.local &&
        n.alive &&
        n.age >= 18 &&
        n.health > 0 &&
        n.location.scene === location.scene &&
        Math.hypot(n.location.x - location.x, n.location.y - location.y) <= 9 &&
        hasLineOfSight(n.location, location, location.scene),
    )
    .map((n) => n.id);
  // One atomic stock transfer. No sale, wage, tax, cash or police knowledge is minted here.
  shop.stock[kind]--;
  s.player.inventory[kind] = (s.player.inventory[kind] ?? 0) + 1;
  (s.progression.items[kind] ??= []).push({
    id: itemId,
    kind,
    acquiredTick: s.tick,
    sourceId: source(id),
  });
  const crime: Crime = {
    id,
    offender: "player",
    victim: shop.ownerId,
    witnesses,
    evidence: witnesses.map((w) => "saw:" + w),
    reported: false,
    status: "unreported",
    tick: s.tick,
    fine: Math.max(2500, value * 2),
    propertyLoss: { businessId: shop.id, kind, itemId, value, location, returnedTick: null },
  };
  s.crimes.push(crime);
  for (const w of witnesses) adjustRelation(s, w, "player", w === shop.ownerId ? -12 : -3, 0, 0, 3);
  const msg =
    ITEMS[kind].name +
    " çantana geçti. " +
    (witnesses.length ? "Seni gören oldu." : "Yakında bir tanık görünmüyor.");
  const event = emit(s, "shop_theft", msg, ["player"], crime.id, "witnessed", witnesses);
  notify(s, msg);
  return { ok: true, reason: msg, events: [event.id] };
}

export function validateProperty(s: WorldState): string[] {
  const errors: string[] = [],
    losses = new Map<string, Crime>();
  for (const c of s.crimes) {
    const l = c.propertyLoss;
    if (l === undefined) continue;
    const b = s.businesses.find((x) => x.id === l?.businessId);
    if (
      !l ||
      !b ||
      !Object.hasOwn(ITEMS, l.kind) ||
      !/^item:[0-9]+$/.test(l.itemId) ||
      losses.has(l.itemId) ||
      !Number.isSafeInteger(l.value) ||
      l.value <= 0 ||
      !l.location ||
      l.location.scene !== b.buildingId ||
      !Number.isFinite(l.location.x) ||
      !Number.isFinite(l.location.y) ||
      !isWalkable(l.location, l.location.scene) ||
      (l.returnedTick !== null &&
        (!Number.isSafeInteger(l.returnedTick) ||
          l.returnedTick < c.tick ||
          l.returnedTick > s.tick))
    ) {
      errors.push("invalid property loss:" + c.id);
      continue;
    }
    losses.set(l.itemId, c);
  }
  for (const list of Object.values(s.progression.items))
    for (const item of list) {
      const crime = losses.get(item.id);
      if (!crime && !item.sourceId.startsWith("stolen:")) continue;
      if (
        !crime ||
        crime.propertyLoss?.returnedTick !== null ||
        crime.propertyLoss.kind !== item.kind ||
        item.acquiredTick !== crime.tick ||
        item.sourceId !== source(crime.id)
      )
        errors.push("invalid property provenance:" + item.id);
    }
  return errors;
}
