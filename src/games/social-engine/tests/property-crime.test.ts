import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, applyCommand, canonicalState, validateState } from "../simulation/engine.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
import { validateProperty } from "../simulation/property-crime.ts";
import { tickJustice } from "../simulation/justice.ts";
import { reconcileProgression } from "../simulation/progression.ts";
const fixture = () => {
  const s = createWorld(20261103),
    b = s.businesses.find((x) => x.id === "market")!;
  s.player.location = { x: 7, y: 9, scene: b.buildingId };
  for (const n of s.npcs)
    if (n.location.scene === b.buildingId) n.location = { ...s.player.location, scene: "b-home" };
  return { s, b };
};
const send = (
  s: ReturnType<typeof createWorld>,
  id: string,
  type = "TAKE_STOCK",
  extra: Record<string, unknown> = {},
) => applyCommand(s, { v: 1, id, type, args: { businessId: "market", item: "simit", ...extra } });
test("C08: one unit leaves the victim's stock, survives a save with its identity, and can be returned exactly once", async () => {
  const { s, b } = fixture(),
    before = b.stock.simit,
    held = s.player.inventory.simit;
  const balances = structuredClone(s.accounts),
    sales = b.sales;
  assert.equal(send(s, "theft-1").ok, true);
  assert.equal(send(s, "theft-1").ok, false);
  assert.equal(b.stock.simit, before - 1);
  assert.equal(s.player.inventory.simit, held + 1);
  const crime = s.crimes.at(-1)!,
    loss = crime.propertyLoss!;
  assert.equal(crime.victim, b.ownerId);
  assert.equal(loss.businessId, b.id);
  assert.equal(loss.value, b.prices.simit);
  assert.deepEqual(loss.location, s.player.location);
  assert.equal(s.progression.items.simit.at(-1)?.id, loss.itemId);
  assert.deepEqual(balances, s.accounts);
  assert.equal(b.sales, sales);
  assert.deepEqual(validateState(s), []);
  const loaded = (await decodeSave(await encodeSave("slot-1", s))).state;
  assert.equal(canonicalState(loaded), canonicalState(s));
  const returnArgs = { crimeId: crime.id };
  assert.equal(
    send(loaded, "wrong-store", "RETURN_STOCK", { ...returnArgs, businessId: "tea" }).ok,
    false,
  );
  assert.equal(send(loaded, "return-1", "RETURN_STOCK", returnArgs).ok, true);
  assert.equal(send(loaded, "return-2", "RETURN_STOCK", returnArgs).ok, false);
  assert.equal(loaded.businesses.find((x) => x.id === "market")!.stock.simit, before);
  assert.equal(loaded.player.inventory.simit, held);
  assert.equal(loaded.crimes.at(-1)!.propertyLoss!.returnedTick, loaded.tick);
  assert.deepEqual(validateState(loaded), []);
});
test("C08: only actual observers remember theft and an unseen loss does not give police a suspect", () => {
  const { s, b } = fixture(),
    owner = s.npcs.find((n) => n.id === b.ownerId)!;
  const earlier = [...owner.memories];
  assert.equal(send(s, "quiet").ok, true);
  const quiet = s.crimes.at(-1)!;
  assert.deepEqual(quiet.witnesses, []);
  assert.deepEqual(owner.memories, earlier);
  tickJustice(s);
  assert.equal(
    s.social.police.cases.some((c) => c.crimeId === quiet.id),
    false,
  );
  owner.location = { ...s.player.location };
  owner.age = 40;
  assert.equal(send(s, "seen").ok, true);
  const seen = s.crimes.at(-1)!;
  assert.deepEqual(seen.witnesses, [owner.id]);
  assert.deepEqual(seen.evidence, ["saw:" + owner.id]);
  assert.ok(owner.memories.includes(s.events.at(-1)!.id));
  assert.ok(s.relations.find((r) => r.from === owner.id && r.to === "player")!.trust < 0);
  assert.equal(s.player.wanted, 0);
});
test("C08: empty stock, forged quantity, own shop, offsite and full bag cannot create goods or incidents", () => {
  for (const mode of [
    "empty",
    "quantity",
    "owner",
    "offsite",
    "capacity",
    "closed",
    "inherited-key",
  ]) {
    const { s, b } = fixture(),
      args: Record<string, unknown> = {};
    if (mode === "empty") b.stock.simit = 0;
    if (mode === "quantity") args.quantity = 2;
    if (mode === "owner") b.ownerId = "player";
    if (mode === "offsite") s.player.location.scene = "outside";
    if (mode === "capacity") {
      s.player.inventory.simit = 30;
      reconcileProgression(s);
    }
    if (mode === "closed") b.status = "closed";
    if (mode === "inherited-key") args.item = "__proto__";
    const before = structuredClone({
      stock: b.stock,
      bag: s.player.inventory,
      cases: s.crimes,
      accounts: s.accounts,
    });
    assert.equal(send(s, mode, "TAKE_STOCK", args).ok, false, mode);
    assert.deepEqual(
      { stock: b.stock, bag: s.player.inventory, cases: s.crimes, accounts: s.accounts },
      before,
      mode,
    );
  }
});
test("C08: another unit of the same kind cannot substitute for a consumed stolen item; forged provenance is rejected", () => {
  const { s, b } = fixture();
  delete s.player.inventory.simit;
  reconcileProgression(s);
  assert.equal(send(s, "take").ok, true);
  const c = s.crimes.at(-1)!,
    unit = s.progression.items.simit[0];
  const good = unit.sourceId;
  unit.sourceId = "world";
  assert.ok(validateProperty(s).length);
  unit.sourceId = good;
  assert.equal(send(s, "eat", "USE_ITEM").ok, true);
  s.player.inventory.simit = 1;
  reconcileProgression(s, "market");
  const stock = b.stock.simit;
  assert.equal(send(s, "substitute", "RETURN_STOCK", { crimeId: c.id }).ok, false);
  assert.equal(b.stock.simit, stock);
  assert.ok(s.crimes.includes(c));
  assert.deepEqual(validateProperty(s), []);
});
