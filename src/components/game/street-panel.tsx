import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAct, formatTicksAsMinutes } from "@/game/clock";
import {
  CREW,
  HOOD_HARAÇ,
  NEIGHBORHOODS,
  PVP_STAMINA_COST,
  TURF_STAMINA,
  turfHourlyOf,
  turfHaraçHourly,
  turfPerkLine,
} from "@/game/data";
import { useGame } from "@/game/store";
import type { Player } from "@/game/types";
import { formatTRY } from "@/lib/utils";

export function StreetPanel({ player }: { player: Player }) {
  const { lang, phrase } = useLang();
  const en = lang !== "tr";
  const rivals = useGame((s) => s.rivals);
  const attackRival = useGame((s) => s.attackRival);
  const putBounty = useGame((s) => s.putBounty);
  const huntBounty = useGame((s) => s.huntBounty);
  const hireCrew = useGame((s) => s.hireCrew);
  const fireCrew = useGame((s) => s.fireCrew);
  const pressTurf = useGame((s) => s.pressTurf);
  const [bountyId, setBountyId] = useState<string | null>(null);
  const [amount, setAmount] = useState("5000");
  const blocked = !canAct(player) || player.stamina < PVP_STAMINA_COST;
  const turfBlocked = !canAct(player) || player.stamina < TURF_STAMINA;
  const totalHarac = turfHaraçHourly(player);
  const bountyAmt = Math.round(Number(amount));
  const bountyBad =
    !Number.isFinite(bountyAmt) ||
    bountyAmt < 500 ||
    player.cash < bountyAmt;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "Turf" : "Semt"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Press a corner, cash haraç lands instantly. Higher percentage unlocks jobs, attack and hourly income. Total haraç"
            : "Köşeyi bas, nakit haraç anında cebine. Yüzde yükseldikçe iş, saldırı ve saatlik gelir açılır. Toplam haraç"}{" "}
          <span className="font-mono text-fg">{formatTRY(totalHarac)}</span>
          {en ? "/hour." : "/saat."}
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {NEIGHBORHOODS.map((n) => {
            const pct = Math.round(player.turf[n.id] ?? 0);
            const hour = turfHourlyOf(player, n.id);
            const home = player.neighborhood === n.id;
            return (
              <li
                key={n.id}
                className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">
                    {n.name}
                    {home ? (
                      <span className="ml-2 text-xs font-medium tracking-wide text-accent uppercase">
                        {en ? "home" : "ev"}
                      </span>
                    ) : null}
                  </h3>
                  <span className="font-mono text-sm tabular-nums text-accent">
                    %{pct}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs tabular-nums text-fg">
                  {formatTRY(hour)}
                  {en ? "/hour" : "/saat"} · {en ? "cap" : "tavan"} {formatTRY(HOOD_HARAÇ[n.id])}
                </p>
                <p className="mt-1 text-xs text-muted">{turfPerkLine(pct)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <Button
                  className="mt-3"
                  disabled={turfBlocked || pct >= 100}
                  onClick={() => pressTurf(n.id)}
                >
                  {en
                    ? `Press the corner · ${TURF_STAMINA} racon · instant cash`
                    : `Köşeyi bas · ${TURF_STAMINA} racon · nakit haraç`}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "Crew" : "Çete"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Three men are enough. Wages are cut hourly; unpaid, they hit the cash box."
            : "Üç adam yeter. Maaş saatlik kesilir; yoksa kasa yer."}
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {CREW.map((c) => {
            const mine = player.crew.includes(c.id);
            const cant =
              !mine &&
              (player.cash < c.hire || player.itibar < c.itibar);
            return (
              <li
                key={c.id}
                className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
              >
                <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                <p className="text-xs tracking-wide text-muted uppercase">
                  {phrase(c.role)}
                </p>
                <p className="mt-2 text-sm text-muted">{phrase(c.perk)}</p>
                <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                  {en ? "Hire" : "Giriş"} {formatTRY(c.hire)} · {en ? "hour" : "saat"} {formatTRY(c.wage)} · {en ? "reputation" : "itibar"}{" "}
                  {c.itibar}
                </p>
                {mine ? (
                  <Button
                    className="mt-3"
                    variant="ghost"
                    onClick={() => fireCrew(c.id)}
                  >
                    {en ? "Cut loose" : "Defterden sil"}
                  </Button>
                ) : (
                  <Button
                    className="mt-3"
                    disabled={cant}
                    onClick={() => hireCrew(c.id)}
                  >
                    {en ? "Hire" : "Al"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "Street" : "Sokak"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Take him down. If you win, empty his pockets — the cash box stays put. If he's rich, put him on the list."
            : "Racon kes. Kazanırsan cebini boşalt — kasa durur. Zenginse sorgu odasına çek."}
        </p>
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {rivals.map((r) => {
            const down = r.hospitalTicks > 0;
            return (
              <li
                key={r.id}
                className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-semibold">
                      {r.name}
                    </h3>
                    <p className="text-xs tracking-wide text-muted uppercase">
                      {r.title} · {en ? "level" : "kıdem"} {r.level}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.bounty > 0 ? (
                      <Badge variant="bad">{en ? "Bounty" : "Ödül"} {formatTRY(r.bounty)}</Badge>
                    ) : null}
                    {down ? <Badge variant="warn">{en ? "Clinic" : "Klinik"}</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                  {formatTRY(r.cash)} · {en ? "health" : "can"} {Math.max(0, r.health)}
                  {down ? ` · ${formatTicksAsMinutes(r.hospitalTicks)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={blocked || down}
                    onClick={() => attackRival(r.id)}
                  >
                    {en ? "Take him down" : "Racon kes"}
                  </Button>
                  {r.bounty > 0 ? (
                    <Button
                      variant="danger"
                      disabled={blocked || down}
                      onClick={() => huntBounty(r.id)}
                    >
                      {en ? "Collect the bounty" : "Topuktan vur"}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={() => setBountyId(bountyId === r.id ? null : r.id)}
                  >
                    {en ? "Put on the list" : "Listeye yaz"}
                  </Button>
                </div>
                {bountyId === r.id ? (
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={500}
                      step={500}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="max-w-40"
                    />
                    <Button
                      variant="danger"
                      disabled={bountyBad}
                      onClick={() => {
                        putBounty(r.id, bountyAmt);
                        setBountyId(null);
                      }}
                    >
                      {en ? "Set" : "Koy"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
