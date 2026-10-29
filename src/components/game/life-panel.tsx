import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { PL_LIFE_ACTS, PL_PARTNERS } from "@/game/cete-pl";
import { Button } from "@/components/ui/button";
import { canAct } from "@/game/clock";
import {
  HORSE_PRICE,
  HORSE_TRAIN,
  LIFE_KID_MAX,
  PARTNER_MAP,
  PARTNERS,
  RACE_FIELD,
} from "@/game/data";
import { energyMax, staminaMax } from "@/game/formulas";
import { useGame } from "@/game/store";
import type { LifeId, Player } from "@/game/types";
import { formatTRY } from "@/lib/utils";

const ACTS: {
  id: LifeId;
  title: string;
  desc: string;
  cost: string;
  /** store.live() içindeki asgari nakit — buton boşuna aktif görünmesin. */
  minCash: number;
}[] = [
  {
    id: "bira",
    title: "Bira çek",
    desc: "Köşe tezgâhı, soğuk şişe. Can ve racon açılır, emniyet biraz düşer.",
    cost: "180 ₺",
    minCash: 180,
  },
  {
    id: "raki",
    title: "Rakı masası",
    desc: "Beyaz, soğuk. Kan yerine gelir, dil açılır.",
    cost: "850 ₺",
    minCash: 850,
  },
  {
    id: "esrar",
    title: "Duman",
    desc: "Arka oda. Can ve mermi dolar, emniyet düşer.",
    cost: "1.100 ₺",
    minCash: 1100,
  },
  {
    id: "pavyon",
    title: "Pavyon gecesi",
    desc: "Sahne ışığı, konsomatris, hesap. Adın döner. Sevgili duyarsa soğur.",
    cost: "4.200 ₺",
    minCash: 4200,
  },
  {
    id: "okey",
    title: "Okey / kâğıt",
    desc: "Çift 7 ya da taş gelmez. Bahis kıdemine göre.",
    cost: "bahis",
    minCash: 400,
  },
];

const CHIPS = [250, 1000, 5000, 20000];

export function LifePanel({ player }: { player: Player }) {
  const { lang } = useLang();
  const pl = lang === "pl";
  const live = useGame((s) => s.live);
  const gamble = useGame((s) => s.gamble);
  const betRace = useGame((s) => s.betRace);
  const buyHorse = useGame((s) => s.buyHorse);
  const trainHorse = useGame((s) => s.trainHorse);
  const raceHorse = useGame((s) => s.raceHorse);
  const relate = useGame((s) => s.relate);
  const resolveFamily = useGame((s) => s.resolveFamily);
  const blocked = !canAct(player);
  const eMax = energyMax(player.level, player.neighborhood);
  const sMax = staminaMax(player.level);
  const [stake, setStake] = useState(1000);
  const chip = Math.min(stake, player.cash);
  // store: bahis 100'ün altındaysa hiçbir masa oynamaz.
  const noBet = blocked || chip < 100 || player.cash < chip;
  const gf = player.girlfriend ? PARTNER_MAP[player.girlfriend] : null;
  const divorceFee = 6000 + player.kids * 4000;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl font-semibold">{pl ? "Życie" : "Hayat"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl ? "Pij, graj, zakładaj rodzinę, obstawiaj wyścigi i buduj relacje. Ulica to nie tylko praca." : "İç, oyna, evlen, kumar, at, gönül. Sokak sadece iş değil."}
          {player.buzz > 0 ? `${pl ? " Upojenie" : " Sarhoşluk"} ${player.buzz}.` : ""}
          {player.high > 0 ? `${pl ? " Odurzenie" : " Duman"} ${player.high}.` : ""}
        </p>
        {player.married ? (
          <p className="mt-2 text-sm text-fg">
            {pl ? `Małżeństwo: ${player.spouse}${player.kids ? ` · dzieci: ${player.kids}` : ""}. Dochód z lokali +5%.` : <>{player.spouse} ile evlisin{player.kids ? ` · ${player.kids} çocuk` : ""}. Mekan +%5.</>}
          </p>
        ) : gf ? (
          <p className="mt-2 text-sm text-fg">
            {pl ? `Partnerka: ${gf.name}. Ślub kosztuje 18 000 ₺.` : <>Sevgili: {gf.name}. Nikâh 18.000 ₺.</>}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">{pl ? "Nie masz partnerki." : "Bekârsın."}</p>
        )}
        {player.pendingFamily ? (
          <div className="mt-4 rounded-2xl bg-elevated p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.12)]">
            <p className="font-display text-lg font-semibold">{pl ? "Wiadomość o dziecku" : "Çocuk haberi"}</p>
            <p className="mt-1 text-sm text-muted">
              {pl ? `${player.pendingFamily.name} stoi w drzwiach. W dzielnicy szybko rozchodzą się plotki. Decyzja należy do ciebie — wpłynie na racon i reputację.` : <>{player.pendingFamily.name} kapıda. Mahalle kulağı ince. Karar senin — racon ve itibar buna göre döner.</>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={blocked || (!player.married && player.cash < 18000)}
                onClick={() => resolveFamily("evlen")}
              >
                {pl ? "Poślub matkę dziecka" : "Karısıyla evlen"}
              </Button>
              <Button
                variant="ghost"
                disabled={blocked}
                onClick={() => resolveFamily("ustlen")}
              >
                {pl ? "Ukryj sprawę, pokryj koszty" : "Gizle, masrafı üstlen"}
              </Button>
              <Button
                variant="ghost"
                disabled={blocked}
                onClick={() => resolveFamily("reddet")}
              >
                {pl ? "Zaprzecz wszystkiemu" : "Yoktun, duymadın"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {ACTS.map((a) => (
          <li
            key={a.id}
            className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
          >
            <h3 className="font-display text-lg font-semibold">{pl ? PL_LIFE_ACTS[a.id]?.title ?? a.title : a.title}</h3>
            <p className="mt-1 text-sm text-muted">{pl ? PL_LIFE_ACTS[a.id]?.desc ?? a.desc : a.desc}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
              {pl && a.id === "okey" ? "stawka" : a.cost}
            </p>
            <Button
              className="mt-3"
              disabled={blocked || player.cash < a.minCash}
              onClick={() => live(a.id)}
            >
              {pl ? "Wykonaj" : "Yap"}
            </Button>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="font-display text-2xl font-semibold">{pl ? "Kasyno" : "Kumarhane"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl ? "Ruletka, blackjack, automaty i zdrapki. Kasyno ma niewielką przewagę." : "Rulet, blackjack, slot, kazı kazan. Masa evi biraz yer."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map((n) => (
            <Button
              key={n}
              variant={stake === n ? "default" : "ghost"}
              onClick={() => setStake(n)}
            >
              {formatTRY(n)}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <CasinoCard
            title="Slot"
            desc={pl ? "Trzy bębny. Trzy siódemki dają dwunastokrotność stawki." : "Üç makara. Üç 7 on iki kat."}
            disabled={noBet}
            onPlay={() => gamble("slot", chip)}
          />
          <CasinoCard
            title={pl ? "Zdrapka" : "Kazı kazan"}
            desc={pl ? "Pod warstwą jest złoto albo nic." : "Çizgi ya altın ya boş."}
            disabled={noBet}
            onPlay={() => gamble("kazi", chip)}
          />
          <CasinoCard
            title="Blackjack"
            desc={pl ? "Jedno rozdanie z krupierem. Wygrywa wynik bliższy 21." : "Bir el, krupiye. 21'e yakın olan alır."}
            disabled={noBet}
            onPlay={() => gamble("blackjack", chip)}
          />
          <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
            <h3 className="font-display text-lg font-semibold">{pl ? "Ruletka" : "Rulet"}</h3>
            <p className="mt-1 text-sm text-muted">
              {pl ? "Czerwone lub czarne płaci dwa razy stawkę. Jeden numer — trzydzieści pięć razy." : "Kırmızı / siyah iki kat. Tek sayı otuz beş."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={noBet}
                onClick={() => gamble("rulet", chip, "kirmizi")}
              >
                {pl ? "Czerwone" : "Kırmızı"}
              </Button>
              <Button
                variant="ghost"
                disabled={noBet}
                onClick={() => gamble("rulet", chip, "siyah")}
              >
                {pl ? "Czarne" : "Siyah"}
              </Button>
              <Button
                variant="ghost"
                disabled={noBet}
                onClick={() => gamble("rulet", chip, "sayi")}
              >
                {pl ? "Jeden numer" : "Tek sayı"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Veliefendi</h2>
        <p className="mt-1 text-sm text-muted">
          {pl ? "Obstawiaj wyścigi lub kup własnego konia. Gdy jego forma spadnie, możesz go trenować." : "Bahis ya da kendi atın. Form düşer, çalıştırırsın."}
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {RACE_FIELD.map((h, i) => (
            <li
              key={h.name}
              className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
            >
              <h3 className="font-display text-lg font-semibold">{h.name}</h3>
              <p className="mt-1 font-mono text-xs tabular-nums text-subtle">
                {h.odds.toFixed(1)}x
              </p>
              <Button
                className="mt-3"
                disabled={noBet}
                onClick={() => betRace(i, chip)}
              >
                {pl ? "Obstaw" : "Bahis"}
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
          <h3 className="font-display text-lg font-semibold">{pl ? "Własny koń" : "At sahipliği"}</h3>
          {player.horse ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {player.horse.name} · {pl ? "prędkość" : "hız"} {Math.round(player.horse.speed)} · {pl ? "forma" : "form"}{" "}
                {Math.round(player.horse.form)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={
                    blocked || player.cash < HORSE_TRAIN || player.energy < 5
                  }
                  onClick={trainHorse}
                >
                  {pl ? "Trenuj" : "Çalıştır"} · {formatTRY(HORSE_TRAIN)}
                </Button>
                <Button
                  variant="ghost"
                  disabled={blocked || player.energy < 6}
                  onClick={raceHorse}
                >
                  {pl ? "Wystaw w wyścigu" : "Yarıştır"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                {pl ? "Kup konia, trenuj go i walcz o puchar." : "Bir at al, çalıştır, kupa koş."}
              </p>
              <Button
                className="mt-3"
                disabled={blocked || player.cash < HORSE_PRICE}
                onClick={buyHorse}
              >
                {pl ? "Kup konia" : "At al"} · {formatTRY(HORSE_PRICE)}
              </Button>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{pl ? "Relacje" : "İlişkiler"}</h2>
        <p className="mt-1 text-sm text-muted">
          {pl ? "Rozmawiaj, dawaj prezenty i umawiaj się na randki. Przy sympatii 25 możesz rozpocząć związek. Spędzaj noce z partnerką; ślub weźmiesz na jej karcie. Wizyty w lokalu ochładzają relację." : "Laf, hediye, randevu. Gönül 25 olunca ilişki başlat. Sevgiliyle gece geçir; nikâh kartın üstünden. Pavyon soğutur."}
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {PARTNERS.map((p) => {
            const aff = Math.round(player.relations?.[p.id] ?? 0);
            const isGf = player.girlfriend === p.id;
            return (
              <li
                key={p.id}
                className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold">
                    {p.name}
                    {isGf ? (
                      <span className="ml-2 text-sm font-medium text-accent">
                        {pl ? "partnerka" : "sevgili"}
                      </span>
                    ) : null}
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {aff}/100
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {pl ? PL_PARTNERS[p.id]?.title ?? p.title : p.title}. {pl ? PL_PARTNERS[p.id]?.desc ?? p.desc : p.desc}
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-elevated"
                  aria-hidden
                >
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${aff}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={
                      blocked ||
                      player.married ||
                      player.cash < 400 ||
                      player.stamina < 3
                    }
                    onClick={() => relate(p.id, "flort")}
                  >
                    {pl ? "Zagadaj" : "Laf at"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={blocked || player.cash < p.gift}
                    onClick={() => relate(p.id, "hediye")}
                  >
                    {pl ? "Prezent" : "Hediye"} · {formatTRY(p.gift)}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      blocked || player.cash < p.date || player.stamina < 4
                    }
                    onClick={() => relate(p.id, "randevu")}
                  >
                    {pl ? "Randka" : "Randevu"}
                  </Button>
                  {!player.married && !player.girlfriend && aff >= 25 ? (
                    <Button
                      disabled={blocked}
                      onClick={() => relate(p.id, "baslat")}
                    >
                      {pl ? "Rozpocznij związek" : "İlişki başlat"}
                    </Button>
                  ) : null}
                  {isGf ? (
                    <>
                      <Button
                        disabled={blocked || player.stamina < 4}
                        onClick={() => relate(p.id, "gece")}
                      >
                        {pl ? "Spędź noc" : "Gece geçir"}
                      </Button>
                      {!player.married ? (
                        <Button
                          disabled={
                            blocked ||
                            player.cash < 18000 ||
                            player.itibar < 12
                          }
                          onClick={() => relate(p.id, "evlen")}
                        >
                          {pl ? "Weź ślub" : "Evlen"}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        disabled={blocked}
                        onClick={() => relate(p.id, "bitir")}
                      >
                        {pl ? "Zakończ związek" : "Bitir"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
          <h3 className="font-display text-lg font-semibold">{pl ? "Ślub" : "Nikâh"}</h3>
          <p className="mt-1 text-sm text-muted">
            {pl ? "Poślub partnerkę albo pozwól dzielnicy znaleźć ci żonę. Małżeństwo zwiększa dochód z nieruchomości." : "Sevgilin varsa onunla. Yoksa mahalle ayarlar. Evlenince emlak şişer."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={
                blocked ||
                player.married ||
                player.cash < 18000 ||
                player.itibar < 12
              }
              onClick={() => live("evlen")}
            >
              {pl ? "Weź ślub" : "Evlen"} · {formatTRY(18000)}
            </Button>
            <Button
              variant="ghost"
              disabled={
                blocked || !player.married || player.cash < divorceFee
              }
              onClick={() => live("bosan")}
            >
              {pl ? "Rozwiedź się" : "Boşan"}
            </Button>
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
          <h3 className="font-display text-lg font-semibold">{pl ? "Dzieci" : "Çocuk"}</h3>
          <p className="mt-1 text-sm text-muted">
            {pl ? `Maksymalnie ${LIFE_KID_MAX}. Rosną wydatki godzinowe i reputacja.` : <>En fazla {LIFE_KID_MAX}. Saatlik harcama artar. İtibar basar.</>}
          </p>
          <Button
            className="mt-3"
            disabled={
              blocked ||
              !player.married ||
              player.kids >= LIFE_KID_MAX ||
              player.cash < 8000
            }
            onClick={() => live("cocuk")}
          >
            {pl ? "Miej dziecko" : "Çocuk yap"} · {formatTRY(8000)}
          </Button>
        </div>
      </section>

      <p className="font-mono text-xs tabular-nums text-subtle">
        {pl ? "Energia" : "Mermi"} {player.energy}/{eMax} · racon {player.stamina}/{sMax} · {pl ? "stawka" : "bahis"}{" "}
        {formatTRY(chip)}
      </p>
    </div>
  );
}

function CasinoCard({
  title,
  desc,
  disabled,
  onPlay,
}: {
  title: string;
  desc: string;
  disabled: boolean;
  onPlay: () => void;
}) {
  const { lang } = useLang();
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <Button className="mt-3" disabled={disabled} onClick={onPlay}>
        {lang === "pl" ? "Graj" : "Oyna"}
      </Button>
    </div>
  );
}
