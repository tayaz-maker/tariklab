import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASSETS,
  ESTATES,
  KOSE_TIERS,
  MARKET_START,
  TICK_MINUTES,
  estateIncomeHourly,
  estateLevel,
  estatePaybackHours,
  holdingOf,
  koseDaysLeft,
  koseUpgradeCost,
  koseWeekly,
  portfolioTRY,
  turfHaraçHourly,
  upgradeCost,
} from "@/game/data";
import { useGame } from "@/game/store";
import type { Estate, InvestId, Player } from "@/game/types";
import { formatTRY } from "@/lib/utils";

export function EstatePanel({ player }: { player: Player }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const bankMove = useGame((s) => s.bankMove);
  const writeSenet = useGame((s) => s.writeSenet);
  const rivals = useGame((s) => s.rivals);
  const market = useGame((s) => s.market) ?? MARKET_START;
  const [bankAmt, setBankAmt] = useState("2000");
  const owned = ESTATES.filter((e) => player.properties.includes(e.id));
  const hourly =
    owned.reduce((a, e) => a + estateIncomeHourly(player, e), 0) +
    turfHaraçHourly(player);
  const port = portfolioTRY(player, market);
  const bankNum = Math.round(Number(bankAmt));
  const bankBad = !Number.isFinite(bankNum) || bankNum <= 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
        <h2 className="font-display text-2xl font-semibold">{en ? "Bank" : "Kasa"}</h2>
        <p className="mt-2 text-sm text-muted">
          {en
            ? "Cash on hand can be robbed. The bank earns interest — small money adds up and the street can't touch it."
            : "Cebindeki nakit gasp edilir. Kasa faizler — küçük para da birikir, sokak göremez."}{" "}
          {formatTRY(player.bank)} {en ? "inside." : "içeride."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={100}
            step={100}
            value={bankAmt}
            onChange={(e) => setBankAmt(e.target.value)}
            className="max-w-36"
          />
          <Button
            onClick={() => bankMove(bankNum, "in")}
            disabled={bankBad || player.cash < bankNum}
          >
            {en ? "Deposit" : "Yatır"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => bankMove(bankNum, "out")}
            disabled={bankBad || player.bank < bankNum}
          >
            {en ? "Withdraw" : "Çek"}
          </Button>
        </div>
        {player.senet ? (
          <p className="mt-4 text-sm text-warn">
            {en ? "Note" : "Senet"}: {player.senet.kind === "borc" ? (en ? "debt" : "borç") : (en ? "credit" : "alacak")} ·{" "}
            {player.senet.name} · {formatTRY(player.senet.amount)} · {en ? "day" : "gün"}{" "}
            {player.senet.dueGun}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => writeSenet("borc")}>
              {en ? "Borrow from the loan shark" : "Tefeciden çek"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => writeSenet("alacak", rivals[0]?.id)}
              disabled={player.cash < 1500}
            >
              {en
                ? `Write a note to ${rivals[0]?.name ?? "a rival"}`
                : `${rivals[0]?.name ?? "Rakibe"} senet yaz`}
            </Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">{en ? "Investment" : "Yatırım"}</h2>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Gold, dollar, USDT. Price moves hourly. Portfolio"
            : "Altın, dolar, USDT. Fiyat saatle yürür. Portföy"}{" "}
          {formatTRY(port)}
          {en ? " — cannot be robbed." : " — gasp edilmez."}
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {ASSETS.map((a) => (
            <AssetCard key={a.id} id={a.id} player={player} />
          ))}
        </ul>
      </section>

      <KoseCard player={player} />

      <EstateList
        title={en ? "Business" : "İş yeri"}
        hint={
          en
            ? `Once you own the place, rent lands every ${TICK_MINUTES} minutes — sitting empty pays nothing. Business pays back in ~90 hours.${hourly > 0 ? ` Currently ${formatTRY(hourly)} / hour (haraç included).` : ""}`
            : `Mekanı alınca her ${TICK_MINUTES} dakikada kira işler — boş oturmak basmaz. İş ~90 saat amorti.${hourly > 0 ? ` Şu an ${formatTRY(hourly)} / saat (haraç dahil).` : ""}`
        }
        list={ESTATES.filter((e) => e.kind !== "konut")}
        player={player}
      />
      <EstateList
        title={en ? "Home" : "Konut"}
        hint={
          en
            ? "House, waterfront villa, island. Rent is thin (~500 hour payback) but boosts reputation. Villa < waterfront < island in cost."
            : "Ev, yalı, ada. Kira ince (~500 saat amorti), itibar basar. Villadan yalı, yalıdan ada pahalı."
        }
        list={ESTATES.filter((e) => e.kind === "konut")}
        player={player}
      />
    </div>
  );
}

function AssetCard({ id, player }: { id: InvestId; player: Player }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const tradeInvest = useGame((s) => s.tradeInvest);
  const market = useGame((s) => s.market) ?? MARKET_START;
  const def = ASSETS.find((a) => a.id === id)!;
  const price = market[id];
  const have = holdingOf(player, id);
  const worth = have * price;
  return (
    <li className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{def.name}</h3>
        <span className="font-mono text-sm tabular-nums text-accent">
          {formatTRY(price)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{def.hint}</p>
      <p className="mt-2 font-mono text-xs tabular-nums text-fg">
        {en ? "Holding" : "Elde"} {have.toLocaleString("tr-TR")} {def.unit} · {formatTRY(worth)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {def.lots.map((n) => (
          <Button
            key={`a${n}`}
            disabled={player.cash < Math.round(n * price)}
            onClick={() => tradeInvest(id, "al", n)}
          >
            {en ? "Buy" : "Al"} {n}
            {def.unit}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {def.lots.map((n) => (
          <Button
            key={`s${n}`}
            variant="ghost"
            disabled={have < n}
            onClick={() => tradeInvest(id, "sat", n)}
          >
            {en ? "Sell" : "Sat"} {n}
            {def.unit}
          </Button>
        ))}
      </div>
    </li>
  );
}

function KoseCard({ player }: { player: Player }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const fundKose = useGame((s) => s.fundKose);
  const t = player.kose ? KOSE_TIERS[player.kose - 1] : null;
  const next = player.kose < 3 ? KOSE_TIERS[player.kose] : null;
  const cost = koseUpgradeCost(player);
  const week = koseWeekly(player);
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
      <h2 className="font-display text-2xl font-semibold">
        {en ? "Dealer's corner" : "Torbacı köşesi"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {en
          ? "A dirty business. Income lands weekly, in cash. Can't be robbed but burns down weekly during a raid. +20% in Tarlabaşı."
          : "Kirli işletme. Gelir haftalık işler, nakit gelir. Gasp edilmez ama baskında haftalık yanar. Tarlabaşı'nda +20%."}
      </p>
      {t ? (
        <p className="mt-3 text-sm text-fg">
          {t.name} · {en ? "weekly" : "haftalık"} {formatTRY(week)} · {koseDaysLeft(player)}{" "}
          {en ? "days left" : "gün kaldı"}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">
          {en ? "Corner is empty. Fund it to open it." : "Köşe boş. Para gömünce döner."}
        </p>
      )}
      {next ? (
        <div className="mt-3">
          <p className="text-sm text-muted">{next.desc}</p>
          <Button
            className="mt-3"
            disabled={player.cash < cost}
            onClick={fundKose}
          >
            {player.kose ? (en ? "Expand" : "Büyüt") : (en ? "Open corner" : "Köşe aç")} ·{" "}
            {formatTRY(cost)}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-accent">
          {en ? "You own the whole turf line." : "Semt hattı sende."}
        </p>
      )}
    </section>
  );
}

function EstateList({
  title,
  hint,
  list,
  player,
}: {
  title: string;
  hint: string;
  list: Estate[];
  player: Player;
}) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const buyEstate = useGame((s) => s.buyEstate);
  const upgradeEstate = useGame((s) => s.upgradeEstate);
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {list.map((e) => {
          const mine = player.properties.includes(e.id);
          const lvl = estateLevel(player, e.id);
          const up = mine && lvl < 2 ? upgradeCost(e, lvl) : 0;
          return (
            <li
              key={e.id}
              className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold">
                  {e.name}
                  {mine && lvl > 0 ? (
                    <span className="ml-2 text-sm font-medium text-muted">
                      {en ? "tier" : "kademe"} {lvl}
                    </span>
                  ) : null}
                </h3>
                <span className="font-mono text-sm tabular-nums text-accent">
                  {formatTRY(e.cost)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{e.desc}</p>
              <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                {en ? "Hourly" : "Saatlik"} {formatTRY(estateIncomeHourly(player, e))} ·{" "}
                {en ? "payback ~" : "amorti ~"}
                {estatePaybackHours(e)} {en ? "hours" : "saat"}
                {e.prestige ? ` · ${en ? "reputation" : "itibar"} +${e.prestige}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={mine || player.cash < e.cost}
                  onClick={() => buyEstate(e.id)}
                >
                  {mine ? (en ? "Yours" : "Senin") : (en ? "Buy" : "Satın al")}
                </Button>
                {mine && lvl < 2 ? (
                  <Button
                    variant="ghost"
                    disabled={player.cash < up}
                    onClick={() => upgradeEstate(e.id)}
                  >
                    {en ? "Upgrade" : "Büyüt"} · {formatTRY(up)}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
