import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import { formatCeteMoney } from "@/game/cete-format";
import { useLang } from "@/lib/i18n";

export function SeasonModal() {
  const { lang } = useLang();
  const formatTRY = (value: number) => formatCeteMoney(value, lang);
  const player = useGame((s) => s.player);
  const ack = useGame((s) => s.ackSeason);
  const c = player?.pendingSeasonCeremony;
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_rgba(239,232,222,0.12)]">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-muted uppercase">
          Sezon
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{lang === "pl" ? "Sezon zakończony" : "Sezon kapandı"}</h2>
        <p className="mt-2 text-sm text-fg">
          {lang === "pl" ? `Wynik ${c.score}. Tytuł: ${c.title === "İstanbul'un babası" ? "Ojciec Stambułu" : c.title === "Sezon bitti" ? "Koniec sezonu" : c.title}.` : <>Skor {c.score}. Unvan: {c.title}.</>}
        </p>
        <p className="mt-1 text-sm text-accent">Bonus {formatTRY(c.bonus)}</p>
        <Button className="mt-5 h-12 w-full" onClick={ack}>
          {lang === "pl" ? "Nowy sezon" : "Yeni sezon"}
        </Button>
      </div>
    </div>
  );
}
