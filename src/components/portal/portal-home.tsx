import { Link } from "@tanstack/react-router";
import { GAME_CATEGORIES, GAMES, type CatalogGame, type GameCategory } from "@/lib/games";
import { catalogEntry, useLang } from "@/lib/i18n";
import { GameIcon } from "./game-icons";
import { LanguageToggle } from "./language-toggle";

function GameCard({ game, featured = false }: { game: CatalogGame; featured?: boolean }) {
  const { lang, t } = useLang();
  const localized = catalogEntry(lang, game.slug, game);
  const title = localized.title;
  const subtitle = localized.subtitle;
  const content = (
    <>
      <GameIcon name={game.icon} />
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug sm:text-lg">{title}</h3>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <span
        className="self-center text-xl text-subtle transition-transform group-hover:translate-x-1"
        aria-hidden="true"
      >
        →
      </span>
    </>
  );
  const classes = `group flex h-full min-h-28 items-start gap-3 rounded-lg border border-border bg-surface/80 p-4 text-left wrap-anywhere transition-colors hover:border-danger/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger sm:min-h-32 sm:gap-4 sm:p-5 ${featured ? "border-danger/50 bg-elevated" : ""}`;
  const label = t("portal.openGame", `${game.title} oyununu aç`, { title });
  if (!game.href)
    return (
      <article
        aria-disabled="true"
        className={`${classes} cursor-default opacity-60 hover:border-border`}
      >
        {content}
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-subtle">
          {t("portal.soon", "Yakında")}
        </span>
      </article>
    );
  if (game.slug === "cete-savaslari")
    return (
      <Link to="/cete-savaslari" aria-label={label} className={classes}>
        {content}
      </Link>
    );
  if (game.href.startsWith("/games/"))
    return (
      <a href={game.href} aria-label={label} className={classes}>
        {content}
      </a>
    );
  return (
    <Link
      to="/oyna/$slug"
      params={{
        slug: game.href?.startsWith("/oyna/") ? game.href.slice("/oyna/".length) : game.slug,
      }}
      aria-label={label}
      className={classes}
    >
      {content}
    </Link>
  );
}

export function PortalHome() {
  const { t } = useLang();
  const active = GAMES.filter((g) => g.status === "live");
  const soon = GAMES.filter((g) => g.status !== "live");
  const categoryTitle = (id: GameCategory) =>
    t(
      `portal.category.${id}`,
      {
        strategy: "Yönetim & Strateji",
        dossier: "Dosya & Karar",
        duel: "Kart & Düello",
        classic: "Klasikler & Bulmaca",
      }[id],
    );
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-3 py-5 sm:px-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4 sm:mb-12 sm:pb-6">
        <div>
          <p className="text-3xl font-semibold tracking-tight sm:text-5xl">TARIKLAB</p>
          <p className="mt-2 text-[0.65rem] font-medium tracking-[0.35em] text-muted uppercase">
            {t("portal.lab", "Oyun Laboratuvarı")}
          </p>
        </div>
        <LanguageToggle />
      </header>
      <section aria-labelledby="active-games">
        <div className="mb-5 flex items-end justify-between gap-3">
          <h1
            id="active-games"
            className="text-sm font-medium uppercase tracking-[0.25em] text-muted"
          >
            {t("portal.games", "Oyunlar")}
          </h1>
          <span className="text-xs text-subtle">
            {t("portal.playableCount", `${active.length} oynanabilir`, { n: active.length })}
          </span>
        </div>
        <div className="space-y-10 sm:space-y-12">
          {GAME_CATEGORIES.map((category) => {
            const games = category.slugs
              .map((slug) => active.find((game) => game.slug === slug))
              .filter((game): game is CatalogGame => Boolean(game));
            return (
              <section key={category.id} aria-labelledby={`category-${category.id}`}>
                <h2
                  id={`category-${category.id}`}
                  className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted sm:mb-4"
                >
                  {categoryTitle(category.id)}
                </h2>
                <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {games.map((game, index) => (
                    <GameCard key={game.slug} game={game} featured={category.id === "strategy" && index === 0} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
      {soon.length > 0 && (
        <section aria-labelledby="coming-soon" className="mt-14">
          <h2
            id="coming-soon"
            className="mb-5 text-sm font-medium uppercase tracking-[0.25em] text-muted"
          >
            {t("portal.soon", "Yakında")}
          </h2>
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
      )}
      <footer className="mt-14 text-center text-xs text-subtle">
        <p>{t("footer.rights", "© 2026 TarikLab. Tüm hakları saklıdır.")}</p>
        <a
          href="/credits.html"
          className="inline-flex min-h-11 items-center hover:text-fg focus-visible:outline-2 focus-visible:outline-danger"
        >
          {t("portal.sources", "Kaynaklar")}
        </a>
      </footer>
    </main>
  );
}
