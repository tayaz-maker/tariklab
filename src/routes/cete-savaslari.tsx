import { createFileRoute, Link } from "@tanstack/react-router";
import { AgeGate } from "@/components/game/age-gate";
import { GameApp } from "@/components/game/game-app";
import { LanguageToggle } from "@/components/portal/language-toggle";
import type { TabId } from "@/game/types";
import { useLang } from "@/lib/i18n";

const TABS: TabId[] = ["ben", "icraat", "tezgah", "emlak", "sokak", "hayat", "klinik"];

export const Route = createFileRoute("/cete-savaslari")({
  ssr: false,
  validateSearch: (raw: Record<string, unknown>) => {
    const v = typeof raw.sekme === "string" ? raw.sekme : "";
    if ((TABS as string[]).includes(v)) return { sekme: v as TabId };
    return {};
  },
  head: () => ({
    meta: [{ title: "Çete Savaşları | TLab" }],
  }),
  component: CetePage,
});

function CetePage() {
  const { t } = useLang();
  return (
    <div className="min-h-dvh bg-bg">
      <div className="relative flex min-h-11 flex-wrap items-center justify-between border-b border-border px-4">
        <Link to="/" className="relative z-10 inline-flex h-11 items-center text-sm text-muted hover:text-fg">
          {t("portal.back", "← Oyunlar")}
        </Link>
        <p className="pointer-events-none order-3 w-full pb-2 text-center font-display text-sm text-fg sm:absolute sm:inset-0 sm:order-none sm:flex sm:items-center sm:justify-center sm:pb-0">
          Çete Savaşları
        </p>
        <LanguageToggle />
      </div>
      <AgeGate>
        <GameApp />
      </AgeGate>
    </div>
  );
}
