import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAct, formatTicksAsMinutes } from "@/game/clock";
import {
  CREW,
  ESNAF_COST, ESNAF_STAMINA, IHBAR_STAMINA,
  crewWageHourly, ihanetSeviye,
  NEIGHBORHOODS,
  PVP_STAMINA_COST,
  TURF_STAMINA,
  turfHourlyOf,
  turfHaraçHourly,
} from "@/game/data";
import { useGame } from "@/game/store";
import { freeCrew, rivalPressure, turfDefense } from "@/game/formulas";
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
  const sitEsnafBar = useGame((s) => s.sitEsnafBar);
  const snitchHood = useGame((s) => s.snitchHood);
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
    <div className="cete-street space-y-8">
      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "District control" : "Semt hâkimiyeti"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Choose fast expansion or quieter local support. Rivals contest control; free crew and armour reduce pressure. District income"
            : "Hızlı genişleme ile sakin yerel destek arasında karar ver. Rakipler kontrolünü aşındırır; serbest ekip ve zırh baskıyı azaltır. Semt geliri"}{" "}
          <span className="font-mono text-fg">{formatTRY(totalHarac)}</span>
          {en ? "/hour." : "/saat."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-elevated p-4 text-sm">
          <div><p className="text-muted">{en ? "Crew wages / hour" : "Ekip gideri / saat"}</p><p className="font-mono">{formatTRY(crewWageHourly(player))}</p></div>
          <div><p className="text-muted">{en ? "Pressure reduction" : "Baskı azaltma"}</p><p className="font-mono">%{Math.round(turfDefense(player) * 100)}</p></div>
        </div>
        <details className="mt-3 text-xs leading-relaxed text-muted"><summary className="flex min-h-11 cursor-pointer items-center text-sm text-fg">{en ? "How district control works" : "Semt dengesi nasıl işler?"}</summary><p>{en ? "Home control improves job success and attack; every district earns income. Away control loses 0.05 points each tick, before rival pressure. Police attention cuts district income at 45 and 70; it cools by 0.5 each ten-minute game step." : "Ana semtin iş başarısını ve saldırını, her semt gelirini etkiler. Yabancı semtler rakip baskısı dışında her adımda 0,05 puan aşınır. Emniyet 45 ve 70 eşiğinde semt gelirini keser; her 10 oyun dakikasında 0,5 azalır."}</p></details>
        <ul className="mt-4 grid gap-3 xl:grid-cols-2">
          {NEIGHBORHOODS.map((n) => {
            const pct = Math.floor((player.turf[n.id] ?? 0) * 10) / 10;
            const hour = turfHourlyOf(player, n.id);
            const home = player.neighborhood === n.id;
            const local = rivals.filter(r => r.hood === n.id && r.alive && r.hospitalTicks === 0);
            const pressure = 1 - local.reduce((chance, r) => chance * (1 - rivalPressure(player, r)), 1);
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
                  {en ? "/hour · net district income" : "/saat · net semt geliri"}
                </p>
                <p className="mt-1 text-xs text-muted">{en ? `Income bonus at 50 / 75 / 100%. ${home ? "Home: job success and attack improve with control." : "Job and attack bonuses apply only at home."}` : `Gelir bonusu: %50 / %75 / %100 kontrol. ${home ? "Ana semt: kontrol iş başarısını ve saldırıyı artırır." : "İş/saldırı bonusu yalnız ana semtte."}`}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <Button
                  className="mt-3 h-auto min-h-11 w-full whitespace-normal py-2"
                  disabled={turfBlocked || pct >= 100}
                  onClick={() => pressTurf(n.id)}
                >
                  {en
                    ? `Press the corner · ${TURF_STAMINA} racon · instant cash`
                    : `Köşeyi bas · ${TURF_STAMINA} racon · nakit haraç`}
                </Button>
                <p className="mt-2 text-xs leading-relaxed text-muted">{en ? "Costs racon; attention +3. Cash scales with control gained." : "Racon harcar; emniyet +3. Nakit, kazanılan kontrolle orantılıdır."}</p>
                <div className="mt-3 grid gap-2">
                  <Button variant="ghost" className="h-auto min-h-11 whitespace-normal py-2" disabled={!canAct(player) || player.stamina < ESNAF_STAMINA || player.cash < ESNAF_COST} onClick={() => sitEsnafBar(n.id)}>{en ? "Visit local traders" : "Esnafla otur"} · {formatTRY(ESNAF_COST)} · {ESNAF_STAMINA} {en ? "stamina" : "racon"}</Button>
                  <p className="text-xs text-muted">{en ? `Control +${home ? "7–11" : "4–8"}, reputation +1, health +3; no attention increase.` : `Kontrol +${home ? "7–11" : "4–8"}, itibar +1, can +3; emniyet artmaz.`}</p>
                  <Button variant="ghost" className="h-auto min-h-11 whitespace-normal py-2" disabled={!canAct(player) || player.stamina < IHBAR_STAMINA || !local.length} onClick={() => snitchHood(n.id)}>{en ? "Inform on a rival" : "Rakibi ihbar et"} · {IHBAR_STAMINA} {en ? "stamina" : "racon"}</Button>
                  <p className="text-xs text-muted">{en ? "One local rival is sidelined. Control +4, attention +10, reputation −2; revenge follows." : "Bir yerel rakip devreden çıkar. Kontrol +4, emniyet +10, itibar −2; intikam riski doğar."}</p>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted">{en ? "Active rivals" : "Aktif rakip"}: {local.length} · {en ? "pressure / 10 min" : "baskı / 10 dk"}: %{Math.round(pressure * 100)}</p>
                <p className="mt-1 text-xs text-muted">{local.map(r => r.name).join(" · ") || (en ? "No active rival" : "Aktif rakip yok")}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "Crew" : "Çete"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Specialists unlock harder jobs. Busy crew cannot be dismissed; assigning lookouts or gunmen also weakens district defence."
            : "Uzmanlar zor işleri açar. Görevdeki üye ayrılamaz; gözcü veya tetikçiyi işe göndermek semt savunmasını da azaltır."}
        </p>
        <p className="mt-2 text-sm text-accent">{en ? "Available" : "Serbest"}: {freeCrew(player).length}/{player.crew.length} · {en ? "Betrayal risk (reputation)" : "İhanet riski (itibar)"}: {en ? ({ yok: "none", düşük: "low", orta: "medium", yüksek: "high" }[ihanetSeviye(player)]) : ihanetSeviye(player)}</p>
        <ul className="mt-4 grid gap-3 xl:grid-cols-2">
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
                    disabled={(player.crewBusy[c.id] ?? 0) > 0}
                    onClick={() => fireCrew(c.id)}
                  >
                    {(player.crewBusy[c.id] ?? 0) > 0 ? `${en ? "On assignment" : "Görevde"} · ${formatTicksAsMinutes(player.crewBusy[c.id] ?? 0)}` : en ? "Cut loose" : "Defterden sil"}
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
        <ul className="mt-5 grid gap-3 xl:grid-cols-2">
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
                <p className="mt-2 text-xs text-muted">{NEIGHBORHOODS.find(n => n.id === r.hood)?.name} · {en ? "Attack" : "Saldırı"} {r.attack}{r.revengeTicks > 0 ? ` · ${en ? "Revenge in" : "İntikam"} ${formatTicksAsMinutes(r.revengeTicks)}` : ""}</p>
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input
                      aria-label={en ? "Bounty amount" : "Ödül tutarı"}
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
