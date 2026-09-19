import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { GAMES, canonicalPlaySlug, isHtml5Slug } from "@/lib/games";
import { CATALOG_EN, useLang } from "@/lib/i18n";

const BY_SLUG = new Map(GAMES.map((g) => [g.slug, g]));

export const Route = createFileRoute("/oyna/$slug")({
  ssr: false,
  beforeLoad: ({ params }) => {
    const canonical = canonicalPlaySlug(params.slug);
    if (!isHtml5Slug(canonical) || !BY_SLUG.has(canonical)) {
      throw notFound();
    }
  },
  head: ({ params }) => {
    const g = BY_SLUG.get(canonicalPlaySlug(params.slug));
    return {
      meta: [{ title: `${g?.title ?? "Oyun"} | TLab` }],
    };
  },
  component: Html5Play,
});

function Html5Play() {
  const { slug } = Route.useParams();
  const canonical = canonicalPlaySlug(slug);
  const g = BY_SLUG.get(canonical);
  const { lang, t } = useLang();
  const title = lang === "en" && g && CATALOG_EN[g.slug] ? CATALOG_EN[g.slug].title : (g?.title ?? "Oyun");
  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg">
      <div className="relative flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-bg/95 px-2.5 sm:px-3">
        <Link
          to="/"
          aria-label={t("portal.back", "Oyunlara dön")}
          className="relative z-10 inline-flex h-9 items-center gap-1 text-xs font-medium text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-danger"
        >
          <span aria-hidden="true">←</span><span className="hidden sm:inline">{t("portal.back", "Oyunlar")}</span>
        </Link>
        <p className="pointer-events-none absolute inset-0 hidden items-center justify-center px-32 text-center font-display text-xs tracking-wide text-fg sm:flex">
          {title}
        </p>
        <LanguageToggle className="[&_button]:py-0.5" />
      </div>
      <iframe
        key={canonical}
        title={title}
        src={`/games/${canonical}/index.html`}
        className="block min-h-0 w-full flex-1 border-0 bg-bg"
        allow="fullscreen; autoplay; gamepad"
      />
    </div>
  );
}
