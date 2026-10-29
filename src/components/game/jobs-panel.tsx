import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAct } from "@/game/clock";
import { CONTRACT_MAP, ITEM_MAP, JOB_TIERS, jobEnergyCost } from "@/game/data";
import { jobSuccessChance, missionCrewBlock, missionCrewNeed } from "@/game/formulas";
import { useGame } from "@/game/store";
import type { Player, Risk } from "@/game/types";
import { formatCeteMoney } from "@/game/cete-format";
import { useCallback, useState } from "react";
import { buildOutcomeMoment, createMomentGate, type OutcomeMoment } from "@/game/outcome-moment";
import { OutcomeMomentCard } from "./outcome-moment";
import { PL_CONTRACTS, PL_ITEMS, PL_JOBS, PL_JOB_TIERS } from "@/game/cete-pl";

function riskVariant(risk: Risk) {
  if (risk === "Düşük") return "ok" as const;
  if (risk === "Orta") return "warn" as const;
  return "bad" as const;
}

export function JobsPanel({ player }: { player: Player }) {
  const { lang, phrase, t } = useLang();
  const formatTRY = (value: number) => formatCeteMoney(value, lang);
  const doJob = useGame((s) => s.doJob);
  const [moment, setMoment] = useState<OutcomeMoment | null>(null);
  const [gate] = useState(createMomentGate);
  const closeMoment = useCallback(() => setMoment(null), []);
  const completeJob = (id: string) => {
    const before = useGame.getState();
    doJob(id);
    const outcome = buildOutcomeMoment(before, useGame.getState(), id);
    if (gate(outcome, performance.now())) setMoment(outcome);
  };
  const blocked = !canAct(player);
  const contract = player.contractId
    ? CONTRACT_MAP[player.contractId]
    : null;

  return (
    <div className="space-y-8">
      {contract ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_35%,transparent)]">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-accent uppercase">
            {t("cete.jobs.contract", "Sözleşme")} · {contract.npc}
          </p>
          <p className="mt-2 text-sm text-fg">{lang === "pl" ? PL_CONTRACTS[contract.id] ?? phrase(contract.text) : phrase(contract.text)}</p>
          <p className="mt-2 font-mono text-xs tabular-nums text-muted">
            {t("cete.jobs.bonusDeadline", "İcraatı bitir, +{bonus} bonus. Yarın biter.", { bonus: formatTRY(contract.bonus) })}
          </p>
        </section>
      ) : null}
      {player.jobsDone < 3 ? (
        <p className="text-sm text-muted">
          {t("cete.jobs.starterHelp", "Çaylak defteri: önce pavyon çıkışı, sonra tombala. Mermi yetmezse saati geçir.")}
        </p>
      ) : null}
      {JOB_TIERS.map((tier) => (
        <section key={tier.tier}>
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-muted uppercase">
            {t("cete.jobs.tier", "Kademe")} {tier.tier}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {lang === "pl" ? PL_JOB_TIERS[tier.tier] ?? phrase(tier.title) : phrase(tier.title)}
          </h2>
          <ul className="mt-4 space-y-3">
            {tier.missions.map((m) => {
              const missing = (m.requiredItems ?? []).filter(
                (id) => !player.inventory.includes(id),
              );
              const cost = jobEnergyCost(player, m.energyCost);
              const noEnergy = player.energy < cost;
              const crewNeed = missionCrewNeed(m.risk);
              const crewNote = missionCrewBlock(player, m.risk);
              const disabled = blocked || noEnergy || missing.length > 0 || Boolean(crewNote);
              const chance = Math.round(
                jobSuccessChance(player, m.risk, m.id) * 100,
              );
              const marked = contract?.missionId === m.id;
              return (
                <li
                  key={m.id}
                  className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">
                      {lang === "pl" ? PL_JOBS[m.id]?.name ?? phrase(m.name) : phrase(m.name)}
                    </h3>
                    <div className="flex gap-1.5">
                      {marked ? <Badge variant="ok">{t("cete.jobs.contract", "Sözleşme")}</Badge> : null}
                      <Badge variant={riskVariant(m.risk)}>{t(`cete.risk.${m.risk}`, m.risk)}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted">{lang === "pl" ? PL_JOBS[m.id]?.desc ?? phrase(m.desc) : phrase(m.desc)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-subtle">
                    <span>{t("cete.jobs.energy", "Mermi")} {cost}</span>
                    <span>
                      {formatTRY(m.rewardCashMin)}–{formatTRY(m.rewardCashMax)}
                    </span>
                    <span>+{m.xpGain} XP</span>
                    <span>{t("cete.jobs.chance", "Şans")} {lang === "pl" ? `${chance}%` : `%${chance}`}</span>
                    {crewNeed ? <span>{lang === "pl" ? `Ekipa: ${crewNeed}` : `${crewNeed} ${t("cete.jobs.crew", "adam")}`}</span> : null}
                  </div>
                  {missing.length > 0 ? (
                    <p className="mt-2 text-xs text-warn">
                      {t("cete.jobs.required", "Gerekli:")}{" "}
                      {missing.map((id) => lang === "pl" ? PL_ITEMS[id]?.name ?? phrase(ITEM_MAP[id]?.name ?? id) : phrase(ITEM_MAP[id]?.name ?? id)).join(", ")}
                    </p>
                  ) : null}
                  {crewNote ? <p className="mt-2 text-xs text-warn">{t("cete.jobs.crewUnavailable", crewNote, { count: crewNeed })}</p> : null}
                  <Button
                    className="mt-4"
                    disabled={disabled}
                    onClick={() => completeJob(m.id)}
                  >
                    {t("cete.jobs.take", "İcraata çık")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <OutcomeMomentCard moment={moment} onClose={closeMoment} />
    </div>
  );
}
