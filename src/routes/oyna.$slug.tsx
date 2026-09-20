import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LanguageToggle } from "@/components/portal/language-toggle";
import { GAMES, canonicalPlaySlug, isHtml5Slug } from "@/lib/games";
import { catalogEntry, useLang } from "@/lib/i18n";

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
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [initialLang] = useState(lang);
  const isJitem = canonical === "jitem-derin-ag";
  const title = g ? catalogEntry(lang, g.slug, g).title : "Oyun";
  // JITEM's embedded runtime currently owns TR/EN content only. Keep the shell
  // Polish, but send its deterministic existing English fallback to the iframe.
  const jitemLocale = lang === "pl" ? "en" : lang;

  useEffect(() => {
    if (!isJitem) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "derin-ag-locale", locale: jitemLocale },
      "*",
    );
  }, [isJitem, jitemLocale]);

  const gameSrc = isJitem
    ? `/games/${canonical}/index.html?embed=1&lang=${initialLang === "pl" ? "en" : initialLang}`
    : `/games/${canonical}/index.html`;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg">
      <div className="relative z-50 flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-bg/95 px-2.5 backdrop-blur sm:px-3">
        <Link
          to="/"
          aria-label={t("portal.back", "Oyunlara dön")}
          className="relative z-10 inline-flex h-8 items-center gap-1 text-xs font-medium text-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-danger"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">{t("portal.back", "Oyunlar")}</span>
        </Link>
        <p className="pointer-events-none absolute inset-0 hidden items-center justify-center px-32 text-center font-display text-xs tracking-wide text-fg sm:flex">
          {title}
        </p>
        <LanguageToggle className="[&_button]:py-0.5" />
      </div>
      <iframe
        ref={frameRef}
        key={canonical}
        title={title}
        src={gameSrc}
        className="block min-h-0 w-full flex-1 border-0 bg-bg"
        allow="fullscreen; autoplay; gamepad"
        onLoad={() => {
          if (!isJitem) return;
          frameRef.current?.contentWindow?.postMessage(
            { type: "derin-ag-locale", locale: jitemLocale },
            "*",
          );
        }}
      />
    </div>
  );
}
