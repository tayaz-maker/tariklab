import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTicksAsMinutes } from "@/game/clock";
import { HEALTH_MAX, HOSPITAL_THRESHOLD, JAIL_TICKS } from "@/game/data";
import { ResetLink } from "@/components/game/reset-confirm";
import { useGame } from "@/game/store";
import type { Player } from "@/game/types";
import { formatTRY } from "@/lib/utils";

export function ClinicPanel({ player }: { player: Player }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const treatClinic = useGame((s) => s.treatClinic);
  const depositBribe = useGame((s) => s.depositBribe);
  const skipHour = useGame((s) => s.skipHour);
  const payBribe = useGame((s) => s.payBribe);
  const [deposit, setDeposit] = useState("2000");
  const fee = Math.round(player.cash * 0.15);
  const depositAmt = Math.floor(Number(deposit));
  const depositBad =
    !Number.isFinite(depositAmt) ||
    depositAmt <= 0 ||
    player.cash < depositAmt;
  // payBribe: önce rüşvet kasasından, kalanı nakitten.
  const bribeCost = 3000 * player.level + 2000;
  const bribeFromCash = Math.max(
    0,
    bribeCost - Math.min(player.rusvet, bribeCost),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
        <h2 className="font-display text-2xl font-semibold">
          {en ? "Underground clinic" : "Gizli klinik"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {en
            ? `No state ER. If your health drops below ${HOSPITAL_THRESHOLD} you can't work. If it hits zero the doctor takes 15% of your cash and you're out for an hour.`
            : `Devlet acili yok. Canın ${HOSPITAL_THRESHOLD}'nin altına düşerse işe gidemezsin. Sıfırlanırsa doktor nakitinin yüzde 15'ini keser ve bir saat yatırırsın.`}
        </p>
        {player.durum === "klinik" ? (
          <p className="mt-3 font-mono text-sm tabular-nums text-warn">
            {en ? "Treatment" : "Müdahale"}: {formatTicksAsMinutes(player.durumTick)}
            {en ? " — pass the time." : " — saati geçir."}
          </p>
        ) : null}
        <Button
          className="mt-4"
          disabled={
            player.durum !== "serbest" ||
            player.health >= HEALTH_MAX ||
            (fee > 0 && player.cash < fee)
          }
          onClick={treatClinic}
        >
          {en ? "Check into the clinic" : "Klinikte yat"} · {formatTRY(fee)} ·{" "}
          {en ? "40 min" : "40 dk"}
        </Button>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
        <h2 className="font-display text-2xl font-semibold">
          {en ? "Bribe fund" : "Rüşvet kasası"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {en
            ? `Burns first in a raid. Fund: ${formatTRY(player.rusvet)}. If caught and it's not enough, cash covers the rest; still short, ${formatTicksAsMinutes(JAIL_TICKS)} in a holding cell.`
            : `Baskında önce burası yanar. Kasa: ${formatTRY(player.rusvet)}. Yakalanınca yetmezse nakitinden tamamlanır; yetmezse ${formatTicksAsMinutes(JAIL_TICKS)} nezarethane.`}
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={100}
            step={100}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="max-w-40"
          />
          <Button
            variant="ghost"
            onClick={() => depositBribe(depositAmt)}
            disabled={depositBad}
          >
            {en ? "Set aside" : "Ayır"}
          </Button>
        </div>
      </section>

      {player.durum === "nezaret" ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-danger)_40%,transparent)]">
          <h2 className="font-display text-2xl font-semibold text-danger">
            {en ? "Holding cell" : "Nezarethane"}
          </h2>
          <p className="mt-2 font-mono text-lg tabular-nums">
            {formatTicksAsMinutes(player.durumTick)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {en
              ? "Let the clock run, or try a bribe. Staring at the wall gets you nowhere."
              : "Saat ilerlesin, ya da zarfı uzat. Duvar izlemenin alemi yok."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={skipHour}>{en ? "Pass 1 hour" : "1 saat geçir"}</Button>
            <Button
              variant="danger"
              onClick={payBribe}
              disabled={player.cash < bribeFromCash}
            >
              {en ? "Try a bribe" : "Rüşvet dene"}
            </Button>
          </div>
        </section>
      ) : null}

      <ResetLink />
    </div>
  );
}
