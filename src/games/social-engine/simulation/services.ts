import type { Business, Person, WorldState } from "../domain/types.ts";
import type { ServiceDesk } from "../domain/economy-types.ts";
import { BUILDINGS } from "../domain/world.ts";
import { transfer } from "./ledger.ts";
const HOURS: Record<string, [number, number]> = {
  market: [360, 1380],
  tea: [360, 1440],
  restaurant: [480, 1440],
  garage: [480, 1200],
  warehouse: [360, 1320],
  office: [480, 1080],
  school: [480, 1200],
  bank: [480, 1080],
};
const MAX_QUEUE = 64;
export function serviceHours(businessId: string): [number, number] {
  return HOURS[businessId] ?? [0, 1440];
}
export function serviceOpen(s: WorldState, b: Business): boolean {
  const [opens, closes] = serviceHours(b.id),
    hour = s.minute % 1440;
  return b.status !== "closed" && hour >= opens && hour < closes;
}
export function initializeServices(s: WorldState): Record<string, ServiceDesk> {
  return Object.fromEntries(
    s.businesses.map((b) => [
      b.id,
      {
        id: `service:${b.id}`,
        schemaVersion: 1,
        updatedTick: s.tick,
        servedMinute: s.minute,
        served: 0,
        queue: [],
      },
    ]),
  );
}
function present(s: WorldState, p: Person, b: Business): boolean {
  if (!p.alive) return false;
  if (p.location.scene === b.buildingId) return true;
  const door = BUILDINGS.find((x) => x.id === b.buildingId)!.door;
  return (
    p.location.scene === "outside" &&
    Math.hypot(p.location.x - door.x, p.location.y - door.y) <= 1.8
  );
}
function clean(s: WorldState, b: Business): ServiceDesk {
  const desk = s.economy.services[b.id];
  if (desk.servedMinute !== s.minute) {
    desk.servedMinute = s.minute;
    desk.served = 0;
    desk.updatedTick = s.tick;
  }
  const length = desk.queue.length;
  desk.queue = desk.queue.filter((q) => {
    const p = q.personId === "player" ? s.player : s.npcs.find((n) => n.id === q.personId);
    return p && q.expiresAt > s.minute && present(s, p, b) && serviceOpen(s, b);
  });
  if (length !== desk.queue.length) desk.updatedTick = s.tick;
  return desk;
}
export function requestService(
  s: WorldState,
  b: Business,
  p: Person,
): { ok: boolean; reason: string } {
  const [opens, closes] = serviceHours(b.id);
  const hour = (v: number) =>
    `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
  if (!serviceOpen(s, b))
    return { ok: false, reason: `Tezgâh kapalı. Hizmet saatleri ${hour(opens)}–${hour(closes)}.` };
  if (!present(s, p, b)) return { ok: false, reason: "Sıraya katılmak için işletmeye yaklaş." };
  const desk = clean(s, b);
  if (!desk.queue.some((q) => q.personId === p.id)) {
    if (desk.queue.length >= MAX_QUEUE)
      return { ok: false, reason: "İşletmenin bekleme alanı dolu; biraz sonra tekrar dene." };
    desk.queue.push({
      id: `queue:${b.id}:${p.id}:${s.tick}`,
      personId: p.id,
      joinedAt: s.minute,
      expiresAt: s.minute + 15,
    });
    desk.updatedTick = s.tick;
  }
  const first = desk.queue[0].personId === p.id;
  return first && desk.served < 12
    ? { ok: true, reason: "" }
    : {
        ok: false,
        reason: "Sıran korunuyor. Tezgâhın yanından ayrılmadan kısa süre sonra yeniden dene.",
      };
}
export function finishService(s: WorldState, b: Business, id: string): void {
  const desk = s.economy.services[b.id];
  if (desk.queue[0]?.personId !== id || desk.served >= 12)
    throw Error("Service reservation mismatch");
  desk.queue.shift();
  desk.served++;
  desk.updatedTick = s.tick;
}
export function requestNpcMeal(s: WorldState, p: Person): void {
  const b = s.businesses.find((b) => b.id === "market")!;
  if (
    p.age >= 18 &&
    p.hunger >= 45 &&
    p.goal === "eat" &&
    present(s, p, b) &&
    s.accounts[p.id] >= b.prices.simit &&
    b.stock.simit > 0
  ) {
    requestService(s, b, p);
    const currentBreak = s.mobility.driverBreaks?.find(
      (x) => x.personId === p.id && ["walkToMarket", "queue"].includes(x.phase),
    );
    const queued = s.economy.services[b.id].queue.find((q) => q.personId === p.id);
    if (currentBreak && queued) {
      currentBreak.mealJoinedTick = Number(queued.id.split(":").at(-1));
      currentBreak.phase = "queue";
    }
  }
}
export function servicesMinute(s: WorldState): void {
  for (const b of s.businesses) {
    const desk = clean(s, b);
    while (desk.queue.length && desk.served < 12) {
      const first = desk.queue[0];
      if (first.personId === "player") break; // Player confirms item/price; never debit on their behalf.
      const p = s.npcs.find((n) => n.id === first.personId)!;
      if (
        b.id !== "market" ||
        p.hunger < 45 ||
        p.age < 18 ||
        s.accounts[p.id] < b.prices.simit ||
        b.stock.simit < 1
      ) {
        desk.queue.shift();
        desk.updatedTick = s.tick;
        continue;
      }
      if (
        !transfer(
          s,
          `meal:v5:${b.id}:${first.id.split(":").at(-1)}:${p.id}`,
          p.id,
          `business:${b.id}`,
          b.prices.simit,
          "food",
        )
      )
        throw Error("Reserved meal could not settle");
      b.stock.simit--;
      b.sales += b.prices.simit;
      p.expenses += b.prices.simit;
      p.hunger = Math.max(0, p.hunger - 40);
      s.economy.lastDemand["market:simit"] = (s.economy.lastDemand["market:simit"] ?? 0) + 1;
      finishService(s, b, p.id);
    }
  }
}
export function validateServices(s: WorldState): string[] {
  const services = s.economy.services,
    errors: string[] = [];
  if (!services || Object.keys(services).length !== s.businesses.length)
    return ["invalid-service-desks"];
  for (const b of s.businesses) {
    const d = services[b.id];
    if (
      !d ||
      d.id !== `service:${b.id}` ||
      d.schemaVersion !== 1 ||
      !Number.isSafeInteger(d.updatedTick) ||
      d.updatedTick < 0 ||
      d.updatedTick > s.tick ||
      !Number.isSafeInteger(d.servedMinute) ||
      d.servedMinute > s.minute ||
      !Number.isInteger(d.served) ||
      d.served < 0 ||
      d.served > 12 ||
      !Array.isArray(d.queue) ||
      d.queue.length > MAX_QUEUE
    ) {
      errors.push("invalid-service-desk:" + b.id);
      continue;
    }
    const seen = new Set<string>();
    for (const q of d.queue) {
      const p = q.personId === "player" ? s.player : s.npcs.find((n) => n.id === q.personId);
      if (
        !p ||
        seen.has(q.personId) ||
        typeof q.id !== "string" ||
        !q.id.startsWith(`queue:${b.id}:${q.personId}:`) ||
        !/^(0|[1-9]\d*)$/.test(q.id.slice(`queue:${b.id}:${q.personId}:`.length)) ||
        !Number.isSafeInteger(Number(q.id.slice(`queue:${b.id}:${q.personId}:`.length))) ||
        Number(q.id.slice(`queue:${b.id}:${q.personId}:`.length)) > s.tick ||
        !Number.isSafeInteger(q.joinedAt) ||
        q.joinedAt > s.minute ||
        q.expiresAt !== q.joinedAt + 15
      )
        errors.push("invalid-service-reservation:" + b.id);
      seen.add(q.personId);
    }
  }
  return errors;
}
