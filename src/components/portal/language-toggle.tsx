import { useLang } from "@/lib/i18n";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div
      className={`inline-flex overflow-hidden rounded-full border border-border ${className}`}
      role="group"
      aria-label={t("lang.label", "Dil")}
    >
      <button
        type="button"
        className={`px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] ${lang === "tr" ? "bg-fg text-bg" : "text-subtle"}`}
        aria-pressed={lang === "tr"}
        onClick={() => setLang("tr")}
      >
        TR
      </button>
      <button
        type="button"
        className={`px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] ${lang === "en" ? "bg-fg text-bg" : "text-subtle"}`}
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`px-2 py-1 text-[11px] font-semibold tracking-[0.08em] ${lang === "pl" ? "bg-fg text-bg" : "text-subtle"}`}
        aria-pressed={lang === "pl"}
        onClick={() => setLang("pl")}
      >
        PL
      </button>
    </div>
  );
}
