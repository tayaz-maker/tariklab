import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAct } from "@/game/clock";
import { CONTRACT_MAP, ITEM_MAP, JOB_TIERS, jobEnergyCost } from "@/game/data";
import { jobSuccessChance, missionCrewBlock, missionCrewNeed } from "@/game/formulas";
import { useGame } from "@/game/store";
import type { Player, Risk } from "@/game/types";
import { formatTRY } from "@/lib/utils";

function riskVariant(risk: Risk) {
  if (risk === "Düşük") return "ok" as const;
  if (risk === "Orta") return "warn" as const;
  return "bad" as const;
}

export function JobsPanel({ player }: { player: Player }) {
  const { lang, phrase } = useLang();
  const en = lang !== "tr";
  const doJob = useGame((s) => s.doJob);
  const blocked = !canAct(player);
  const contract = player.contractId
    ? CONTRACT_MAP[player.contractId]
    : null;

  return (
    <div className="space-y-8">
      {contract ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_35%,transparent)]">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-accent uppercase">
            {en ? "Contract" : "Sözleşme"} · {contract.npc}
          </p>
          <p className="mt-2 text-sm text-fg">{phrase(contract.text)}</p>
          <p className="mt-2 font-mono text-xs tabular-nums text-muted">
            {en ? `Complete the marked job for a ${formatTRY(contract.bonus)} bonus. Expires tomorrow.` : `İcraatı bitir, +${formatTRY(contract.bonus)} bonus. Yarın biter.`}
          </p>
        </section>
      ) : null}
      {player.jobsDone < 3 ? (
        <p className="text-sm text-muted">
          {en ? "Start with the first low-risk job. Recruit a free crew member for riskier jobs. Pass time to recover energy." : "Çaylak defteri: önce pavyon çıkışı, sonra tombala. Mermi yetmezse saati geçir."}
        </p>
      ) : null}
      {JOB_TIERS.map((tier) => (
        <section key={tier.tier}>
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-muted uppercase">
            {en ? "Tier" : "Kademe"} {tier.tier}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {phrase(tier.title)}
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
                      {phrase(m.name)}
                    </h3>
                    <div className="flex gap-1.5">
                      {marked ? <Badge variant="ok">{en ? "Contract" : "Sözleşme"}</Badge> : null}
                      <Badge variant={riskVariant(m.risk)}>{en ? ({Düşük: "Low", Orta: "Medium", Yüksek: "High", "Çok Yüksek": "Very high", Kritik: "Critical"}[m.risk]) : m.risk}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted">{phrase(m.desc)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-subtle">
                    <span>{en ? "Energy" : "Mermi"} {cost}</span>
                    <span>
                      {formatTRY(m.rewardCashMin)}–{formatTRY(m.rewardCashMax)}
                    </span>
                    <span>+{m.xpGain} XP</span>
                    <span>{en ? "Chance" : "Şans"} %{chance}</span>
                    {crewNeed ? <span>{crewNeed} {en ? "crew" : "adam"}</span> : null}
                  </div>
                  {missing.length > 0 ? (
                    <p className="mt-2 text-xs text-warn">
                      {en ? "Required:" : "Gerekli:"}{" "}
                      {missing.map((id) => phrase(ITEM_MAP[id]?.name ?? id)).join(", ")}
                    </p>
                  ) : null}
                  {crewNote ? <p className="mt-2 text-xs text-warn">{en ? `Requires ${crewNeed} available crew. Busy crew cannot join.` : crewNote}</p> : null}
                  <Button
                    className="mt-4"
                    disabled={disabled}
                    onClick={() => doJob(m.id)}
                  >
                    {en ? "Take job" : "İcraata çık"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}