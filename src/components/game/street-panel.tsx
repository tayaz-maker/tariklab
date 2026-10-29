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
import { PL_CREW, PL_CREW_NAMES, PL_RIVAL_TITLES } from "@/game/cete-pl";

export function StreetPanel({ player }: { player: Player }) {
  const { lang, phrase } = useLang();
  const en = lang !== "tr";
  const pl = lang === "pl";
  const minutes = (ticks: number) => pl ? formatTicksAsMinutes(ticks).replace(/ dk$/, " min") : formatTicksAsMinutes(ticks);
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
        <h2 className="font-display text-2xl font-semibold">{pl ? "Kontrola dzielnic" : en ? "District control" : "Semt hâkimiyeti"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl
            ? "Wybierz szybkie rozszerzanie wpływów albo spokojniejsze wsparcie miejscowych. Rywale osłabiają kontrolę; wolna ekipa i pancerz zmniejszają presję. Dochód z dzielnic"
            : en
            ? "Choose fast expansion or quieter local support. Rivals contest control; free crew and armour reduce pressure. District income"
            : "Hızlı genişleme ile sakin yerel destek arasında karar ver. Rakipler kontrolünü aşındırır; serbest ekip ve zırh baskıyı azaltır. Semt geliri"}{" "}
          <span className="font-mono text-fg">{formatTRY(totalHarac)}</span>
          {pl ? "/godz." : en ? "/hour." : "/saat."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-elevated p-4 text-sm">
          <div><p className="text-muted">{pl ? "Płace ekipy / godz." : en ? "Crew wages / hour" : "Ekip gideri / saat"}</p><p className="font-mono">{formatTRY(crewWageHourly(player))}</p></div>
          <div><p className="text-muted">{pl ? "Zmniejszenie presji" : en ? "Pressure reduction" : "Baskı azaltma"}</p><p className="font-mono">%{Math.round(turfDefense(player) * 100)}</p></div>
        </div>
        <details className="mt-3 text-xs leading-relaxed text-muted"><summary className="flex min-h-11 cursor-pointer items-center text-sm text-fg">{pl ? "Jak działa kontrola dzielnic" : en ? "How district control works" : "Semt dengesi nasıl işler?"}</summary><p>{pl ? "Kontrola własnej dzielnicy zwiększa skuteczność zleceń i atak; każda dzielnica przynosi dochód. Kontrola obcych dzielnic spada o 0,05 punktu na krok, niezależnie od presji rywali. Presja policji zmniejsza dochód przy progach 45 i 70; spada o 0,5 co 10 minut czasu gry." : en ? "Home control improves job success and attack; every district earns income. Away control loses 0.05 points each tick, before rival pressure. Police attention cuts district income at 45 and 70; it cools by 0.5 each ten-minute game step." : "Ana semtin iş başarısını ve saldırını, her semt gelirini etkiler. Yabancı semtler rakip baskısı dışında her adımda 0,05 puan aşınır. Emniyet 45 ve 70 eşiğinde semt gelirini keser; her 10 oyun dakikasında 0,5 azalır."}</p></details>
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
                        {pl ? "własna" : en ? "home" : "ev"}
                      </span>
                    ) : null}
                  </h3>
                  <span className="font-mono text-sm tabular-nums text-accent">
                    %{pct}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs tabular-nums text-fg">
                  {formatTRY(hour)}
                  {pl ? "/godz. · dochód netto z dzielnicy" : en ? "/hour · net district income" : "/saat · net semt geliri"}
                </p>
                <p className="mt-1 text-xs text-muted">{pl ? `Premia do dochodu przy kontroli 50 / 75 / 100%. ${home ? "Własna dzielnica: kontrola zwiększa skuteczność zleceń i atak." : "Premie do zleceń i ataku dotyczą tylko własnej dzielnicy."}` : en ? `Income bonus at 50 / 75 / 100%. ${home ? "Home: job success and attack improve with control." : "Job and attack bonuses apply only at home."}` : `Gelir bonusu: %50 / %75 / %100 kontrol. ${home ? "Ana semt: kontrol iş başarısını ve saldırıyı artırır." : "İş/saldırı bonusu yalnız ana semtte."}`}</p>
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
                  {pl
                    ? `Przejmij róg · ${TURF_STAMINA} racon · gotówka od razu`
                    : en
                    ? `Press the corner · ${TURF_STAMINA} racon · instant cash`
                    : `Köşeyi bas · ${TURF_STAMINA} racon · nakit haraç`}
                </Button>
                <p className="mt-2 text-xs leading-relaxed text-muted">{pl ? "Kosztuje racon; presja policji +3. Gotówka zależy od zdobytej kontroli." : en ? "Costs racon; attention +3. Cash scales with control gained." : "Racon harcar; emniyet +3. Nakit, kazanılan kontrolle orantılıdır."}</p>
                <div className="mt-3 grid gap-2">
                  <Button variant="ghost" className="h-auto min-h-11 whitespace-normal py-2" disabled={!canAct(player) || player.stamina < ESNAF_STAMINA || player.cash < ESNAF_COST} onClick={() => sitEsnafBar(n.id)}>{pl ? "Spotkaj się z kupcami" : en ? "Visit local traders" : "Esnafla otur"} · {formatTRY(ESNAF_COST)} · {ESNAF_STAMINA} {pl ? "racon" : en ? "stamina" : "racon"}</Button>
                  <p className="text-xs text-muted">{pl ? `Kontrola +${home ? "7–11" : "4–8"}, reputacja +1, zdrowie +3; presja policji nie rośnie.` : en ? `Control +${home ? "7–11" : "4–8"}, reputation +1, health +3; no attention increase.` : `Kontrol +${home ? "7–11" : "4–8"}, itibar +1, can +3; emniyet artmaz.`}</p>
                  <Button variant="ghost" className="h-auto min-h-11 whitespace-normal py-2" disabled={!canAct(player) || player.stamina < IHBAR_STAMINA || !local.length} onClick={() => snitchHood(n.id)}>{pl ? "Donieś na rywala" : en ? "Inform on a rival" : "Rakibi ihbar et"} · {IHBAR_STAMINA} {pl ? "racon" : en ? "stamina" : "racon"}</Button>
                  <p className="text-xs text-muted">{pl ? "Jeden miejscowy rywal zostaje wyłączony z gry. Kontrola +4, presja policji +10, reputacja −2; grozi zemsta." : en ? "One local rival is sidelined. Control +4, attention +10, reputation −2; revenge follows." : "Bir yerel rakip devreden çıkar. Kontrol +4, emniyet +10, itibar −2; intikam riski doğar."}</p>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted">{pl ? "Aktywni rywale" : en ? "Active rivals" : "Aktif rakip"}: {local.length} · {pl ? "presja / 10 min" : en ? "pressure / 10 min" : "baskı / 10 dk"}: %{Math.round(pressure * 100)}</p>
                <p className="mt-1 text-xs text-muted">{local.map(r => r.name).join(" · ") || (pl ? "Brak aktywnych rywali" : en ? "No active rival" : "Aktif rakip yok")}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{pl ? "Ekipa" : en ? "Crew" : "Çete"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl
            ? "Specjaliści odblokowują trudniejsze zlecenia. Zajętej osoby nie można zwolnić; wysłanie czujki lub strzelca osłabia obronę dzielnicy."
            : en
            ? "Specialists unlock harder jobs. Busy crew cannot be dismissed; assigning lookouts or gunmen also weakens district defence."
            : "Uzmanlar zor işleri açar. Görevdeki üye ayrılamaz; gözcü veya tetikçiyi işe göndermek semt savunmasını da azaltır."}
        </p>
        <p className="mt-2 text-sm text-accent">{pl ? "Dostępni" : en ? "Available" : "Serbest"}: {freeCrew(player).length}/{player.crew.length} · {pl ? "Ryzyko zdrady (reputacja)" : en ? "Betrayal risk (reputation)" : "İhanet riski (itibar)"}: {pl ? ({ yok: "brak", düşük: "niskie", orta: "średnie", yüksek: "wysokie" }[ihanetSeviye(player)]) : en ? ({ yok: "none", düşük: "low", orta: "medium", yüksek: "high" }[ihanetSeviye(player)]) : ihanetSeviye(player)}</p>
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
                <h3 className="font-display text-lg font-semibold">{pl ? PL_CREW_NAMES[c.id] ?? c.name : c.name}</h3>
                <p className="text-xs tracking-wide text-muted uppercase">
                  {pl ? PL_CREW[c.id]?.role ?? phrase(c.role) : phrase(c.role)}
                </p>
                <p className="mt-2 text-sm text-muted">{pl ? PL_CREW[c.id]?.perk ?? phrase(c.perk) : phrase(c.perk)}</p>
                <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                  {pl ? "Werbunek" : en ? "Hire" : "Giriş"} {formatTRY(c.hire)} · {pl ? "godz." : en ? "hour" : "saat"} {formatTRY(c.wage)} · {pl ? "reputacja" : en ? "reputation" : "itibar"}{" "}
                  {c.itibar}
                </p>
                {mine ? (
                  <Button
                    className="mt-3"
                    variant="ghost"
                    disabled={(player.crewBusy[c.id] ?? 0) > 0}
                    onClick={() => fireCrew(c.id)}
                  >
                    {(player.crewBusy[c.id] ?? 0) > 0 ? `${pl ? "Na zleceniu" : en ? "On assignment" : "Görevde"} · ${minutes(player.crewBusy[c.id] ?? 0)}` : pl ? "Zwolnij" : en ? "Cut loose" : "Defterden sil"}
                  </Button>
                ) : (
                  <Button
                    className="mt-3"
                    disabled={cant}
                    onClick={() => hireCrew(c.id)}
                  >
                    {pl ? "Zwerbuj" : en ? "Hire" : "Al"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{pl ? "Ulica" : en ? "Street" : "Sokak"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl
            ? "Pokonaj rywala. Jeśli wygrasz, opróżnisz mu kieszenie; pieniądze w kasie zostaną na miejscu. Bogatego rywala możesz wpisać na listę."
            : en
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
                      {pl ? PL_RIVAL_TITLES[r.title] ?? r.title : r.title} · {pl ? "poziom" : en ? "level" : "kıdem"} {r.level}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.bounty > 0 ? (
                      <Badge variant="bad">{pl ? "Nagroda" : en ? "Bounty" : "Ödül"} {formatTRY(r.bounty)}</Badge>
                    ) : null}
                    {down ? <Badge variant="warn">{pl ? "Klinika" : en ? "Clinic" : "Klinik"}</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                  {formatTRY(r.cash)} · {pl ? "zdrowie" : en ? "health" : "can"} {Math.max(0, r.health)}
                  {down ? ` · ${minutes(r.hospitalTicks)}` : ""}
                </p>
                <p className="mt-2 text-xs text-muted">{NEIGHBORHOODS.find(n => n.id === r.hood)?.name} · {pl ? "Atak" : en ? "Attack" : "Saldırı"} {r.attack}{r.revengeTicks > 0 ? ` · ${pl ? "Zemsta za" : en ? "Revenge in" : "İntikam"} ${minutes(r.revengeTicks)}` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={blocked || down}
                    onClick={() => attackRival(r.id)}
                  >
                    {pl ? "Załatw rywala" : en ? "Take him down" : "Racon kes"}
                  </Button>
                  {r.bounty > 0 ? (
                    <Button
                      variant="danger"
                      disabled={blocked || down}
                      onClick={() => huntBounty(r.id)}
                    >
                      {pl ? "Odbierz nagrodę" : en ? "Collect the bounty" : "Topuktan vur"}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={() => setBountyId(bountyId === r.id ? null : r.id)}
                  >
                    {pl ? "Wpisz na listę" : en ? "Put on the list" : "Listeye yaz"}
                  </Button>
                </div>
                {bountyId === r.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input
                      aria-label={pl ? "Kwota nagrody" : en ? "Bounty amount" : "Ödül tutarı"}
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
                      {pl ? "Ustal" : en ? "Set" : "Koy"}
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
