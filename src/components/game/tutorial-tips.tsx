import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";

const STEPS = [
  "İlk iş: İcraat’ten pavyon çıkışı veya tombala.",
  "Silah al: Tezgâh’tan eline düzgün bir şey geçir.",
  "Köşe / semt: Sokak’ta köşe bas veya semt sık.",
  "Kasaya yatır: Ben / kasa — nakit sokakta yanar.",
];

export function TutorialTips() {
  const { t } = useLang();
  const player = useGame((s) => s.player);
  const skip = useGame((s) => s.skipTutorial);
  const step = player?.tutorialStep ?? 0;
  if (!player || step < 0 || step >= 4) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-2 md:px-6">
      <div className="flex items-start justify-between gap-3 rounded-xl bg-elevated px-3 py-2 text-sm">
        <p className="text-fg">
          <span className="text-muted">{step + 1}/4 · </span>
          {t(`cete.tutorial.step${step + 1}`, STEPS[step])}
        </p>
        <Button variant="ghost" size="sm" onClick={skip}>
          {t("cete.tutorial.skip", "Atla")}
        </Button>
      </div>
    </div>
  );
}
