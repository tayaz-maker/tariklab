import type { CommandResult, WorldState } from "../domain/types.ts";
import { ITEMS } from "../domain/content.ts";
import { transfer } from "./ledger.ts";
import { emit, adjustRelation } from "./events.ts";
export function finishWorkOrder(s: WorldState, choice: unknown): CommandResult {
  const fail = (reason: string) => ({ ok: false, reason, events: [] });
  const p = s.player,
    shift = p.shift,
    b = s.businesses.find((x) => x.id === p.employerId);
  if (
    !shift ||
    !b ||
    shift.businessId !== b.id ||
    p.location.scene !== b.buildingId ||
    p.wanted ||
    p.health < 25 ||
    b.status === "closed" ||
    s.minute >= shift.endsAt
  )
    return fail("Bu işi yapmak için açık işyerinde aktif bir vardiyada olmalısın.");
  if ((shift.order !== "retail" && shift.order !== "mechanic") || shift.order !== p.jobId)
    return fail("Bu vardiyada açık iş emri yok.");
  let note: string;
  if (shift.order === "retail") {
    const buyer = s.businesses.find(
      (x) => x.id === choice && (x.id === "tea" || x.id === "restaurant"),
    );
    const qty = buyer ? Math.min(6, Math.floor((b.stock.simit - buyer.stock.simit) / 2)) : 0;
    if (!buyer || buyer.status === "closed" || qty < 1)
      return fail("Bu işletmenin şu anda ek simide ihtiyacı yok.");
    const price = qty * Math.max(1, Math.floor(b.prices.simit * 0.65));
    if (
      !transfer(
        s,
        "order:" + shift.id,
        "business:" + buyer.id,
        "business:" + b.id,
        price,
        "retail-wholesale-order",
      )
    )
      return fail("Siparişi karşılayacak bütçe yok.");
    b.stock.simit -= qty;
    buyer.stock.simit += qty;
    b.sales += price;
    s.economy.lastDemand[b.id + ":simit"] = (s.economy.lastDemand[b.id + ":simit"] ?? 0) + qty;
    note =
      qty +
      " simit " +
      (buyer.id === "tea" ? "çayevine" : "lokantaya") +
      " ayrıldı; ödeme marketin hesabına geçti.";
  } else {
    const qty = choice === "single" ? 1 : choice === "batch" ? 3 : 0,
      cost = qty * Math.floor(ITEMS.parts.price * 0.22);
    if (!qty || s.economy.wholesaler.metal < qty) return fail("Bu iş emri için yeterli metal yok.");
    if (
      !transfer(
        s,
        "order:" + shift.id,
        "business:" + b.id,
        "wholesaler",
        cost,
        "garage-parts-order",
      )
    )
      return fail("Atölyenin malzeme bütçesi yetersiz.");
    s.economy.wholesaler.metal -= qty;
    s.economy.consumedInputs.metal = (s.economy.consumedInputs.metal ?? 0) + qty;
    s.economy.produced.parts = (s.economy.produced.parts ?? 0) + qty;
    b.stock.parts += qty;
    note = qty + " yedek parça işlendi. Metal bedeli ödendi; parçalar atölyede satışa hazır.";
  }
  shift.order = "done";
  adjustRelation(s, b.ownerId, "player", 2);
  const ev = emit(s, "work_order", note, ["player", b.ownerId], b.id, "private");
  return { ok: true, reason: note, events: [ev.id] };
}
