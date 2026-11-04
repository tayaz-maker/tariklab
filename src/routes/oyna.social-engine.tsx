import { createFileRoute, Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/oyna/social-engine")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SOCIAL ENGINE" },
      { name: "description", content: "DARAMCIK’ta çalış, komşularını tanı ve kararlarının sonuçlarını yaşa." },
    ],
  }),
  component: SocialEngineRoute,
});

function SocialEngineRoute() {
  const { t } = useLang();
  return (
    <main className="flex h-dvh min-h-0 flex-col bg-bg">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3 text-xs text-muted">
        <Link to="/" aria-label={t("portal.back", "← Oyunlar")}>← TarikLab</Link>
        <span>SOCIAL ENGINE · DARAMCIK</span>
      </header>
      <iframe
        className="min-h-0 flex-1 border-0"
        title="SOCIAL ENGINE"
        src="/games/social-engine/index.html"
        allow="fullscreen"
      />
    </main>
  );
}
