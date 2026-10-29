import { formatTRY } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

/** Polish display only; preserve the existing TRY formatting for TR and EN. */
export function formatCeteMoney(value: number, lang: Lang): string {
  return lang === "pl"
    ? `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Math.round(value))} ₺`
    : formatTRY(value);
}

/** Reformat numeric lira amounts in translated historical text, without changing its stored bytes. */
export function formatPolishLogMoney(text: string): string {
  return text.replace(/\d[\d.,]*(?= ₺)/g, (value) =>
    value.replace(/\.(?=\d{3}(?:\.|,|$))/g, "\u00a0").replace(".", ","),
  );
}
