import { memo } from "react";
import { useLang } from "@/lib/i18n";
import { polishLog } from "@/game/cete-pl-log";
import { formatStamp } from "@/game/clock";
import type { LogEntry } from "@/game/types";
import { formatTRY } from "@/lib/utils";

export const LogFeed = memo(function LogFeed({ logs }: { logs: LogEntry[] }) {
  const { lang } = useLang();
  const rows = logs.slice(0, 24);
  if (!rows.length) {
    return (
      <p className="text-sm text-muted">
        {lang === "pl" ? "Na ulicy panuje cisza. Pierwsze zlecenie otworzy dziennik." : "Sokak henüz sessiz. İlk icraat defteri açar."}
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {rows.map((l, i) => (
        <li
          key={l.id}
          className="border-b border-border pb-3 last:border-0"
          aria-live={i === 0 ? "polite" : undefined}
        >
          <p className="text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            {kindLabel(l.kind, lang === "pl")} · {formatStamp(l.at)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-fg">{lang === "pl" ? polishLog(l.text) : l.text}</p>
          {typeof l.moneyDelta === "number" && l.moneyDelta !== 0 ? (
            <p
              className={`mt-1 font-mono text-xs tabular-nums ${
                l.moneyDelta > 0 ? "text-ok" : "text-danger"
              }`}
            >
              {l.moneyDelta > 0 ? "+" : ""}
              {formatTRY(l.moneyDelta)}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
});

function kindLabel(k: LogEntry["kind"], pl: boolean) {
  if (pl) return ({ job: "Zlecenie", pvp: "Racon", shop: "Sklep", estate: "Nieruchomości", jail: "Policja", clinic: "Klinika", bounty: "Lista", crew: "Ekipa", bank: "Kasa", turf: "Dzielnica", contract: "Kontrakt", life: "Życie", invest: "Inwestycje", system: "Ulica" } as Partial<Record<LogEntry["kind"], string>>)[k] ?? "Ulica";
  switch (k) {
    case "job":
      return "İcraat";
    case "pvp":
      return "Racon";
    case "shop":
      return "Tezgâh";
    case "estate":
      return "Emlak";
    case "jail":
      return "Emniyet";
    case "clinic":
      return "Klinik";
    case "bounty":
      return "Liste";
    case "crew":
      return "Çete";
    case "bank":
      return "Kasa";
    case "turf":
      return "Semt";
    case "contract":
      return "Sözleşme";
    case "life":
      return "Hayat";
    case "invest":
      return "Yatırım";
    default:
      return "Sokak";
  }
}
