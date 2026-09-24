import { useLang } from "@/lib/i18n";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SaveSlotsPanel } from "@/components/game/save-slots-panel";
import { Button } from "@/components/ui/button";
import { HelpPanel } from "@/components/game/help-panel";
import { ResetConfirm } from "@/components/game/reset-confirm";
import { StatBar } from "@/components/game/stat-bar";
import { formatClock, formatTicksAsMinutes } from "@/game/clock";
import {
  HEAT_MAX,
  HOSPITAL_THRESHOLD,
  ITEM_MAP,
  MARKET_START,
  PARTNER_MAP,
  SEASON_DAYS,
  portfolioTRY,
} from "@/game/data";
import { energyMax, lakap, staminaMax, xpToNext } from "@/game/formulas";
import { useGame } from "@/game/store";
import type { Player } from "@/game/types";
import { cn, formatTRY } from "@/lib/utils";

/** Üç kontrol dar telefonda tek satırda kalsın; dokunma alanı h-11 kalır. */
const CTRL_BTN = "px-3 text-xs md:px-4 md:text-sm";

const HOOD: Record<Player["neighborhood"], string> = {
  eyup: "Eyüp",
  tarlabasi: "Tarlabaşı",
  kadikoy: "Kadıköy",
  sultangazi: "Sultangazi",
};

export function Hud({
  player,
}: {
  player: Player;
  onAccount?: (tab?: "giris" | "kayit" | "unuttum" | "sifre") => void;
}) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const [detailOpen, setDetailOpen] = useState(false);
  const hiz = useGame((s) => s.hiz);
  const toggleHiz = useGame((s) => s.toggleHiz);
  const skipHour = useGame((s) => s.skipHour);
  const market = useGame((s) => s.market) ?? MARKET_START;
  const eMax = energyMax(player.level, player.neighborhood);
  const sMax = staminaMax(player.level);
  const locked =
    player.durum !== "serbest" || player.health < HOSPITAL_THRESHOLD;
  const dayInSeason = Math.min(
    SEASON_DAYS,
    Math.max(1, player.gun - (player.seasonGun || 1) + 1),
  );
  const yatirim = portfolioTRY(player, market);
  const loadout =
    [
      player.equippedWeapon ? ITEM_MAP[player.equippedWeapon]?.name : null,
      player.equippedArmor ? ITEM_MAP[player.equippedArmor]?.name : null,
      player.equippedVehicle ? ITEM_MAP[player.equippedVehicle]?.name : null,
      player.crew.length ? `${player.crew.length} adam` : null,
      player.married ? player.spouse : null,
      !player.married && player.girlfriend
        ? PARTNER_MAP[player.girlfriend]?.name
        : null,
      player.kids ? `${player.kids} çocuk` : null,
      player.horse ? player.horse.name : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Üstün boş, elinde şişe bile yok.";

  return (
    <header className="hud-header sticky top-0 z-30 border-b border-border bg-bg/95 px-3 py-2 backdrop-blur md:px-4">
      {/*
        Telefonda HUD tüm ilk ekranı yiyordu. Mobilde hayati olanlar (isim,
        nakit, saat, dört çubuk, uyarı) hep açık; künye/kutular/sıfırlama
        "Detay" altında. md+ hepsi açık ve sıra masaüstündeki gibi:
        kimlik → kutular → butonlar → çubuklar → uyarı (md:order-*).
      */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="order-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl leading-none font-semibold tracking-tight md:text-2xl">
              {player.name}
              <span className="ml-2 text-base font-medium text-fg md:text-lg">
                {lakap(player.level)}
              </span>
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-accent md:hidden">
              {formatClock(player)}
            </p>
            <p className="mt-1 hidden text-sm text-fg md:block">{loadout}</p>
          </div>
          <p className="shrink-0 font-mono text-xl font-semibold tabular-nums text-accent md:text-2xl">
            {formatTRY(player.cash)}
          </p>
        </div>

        <div className="order-2 grid grid-cols-4 gap-x-2 gap-y-1 sm:gap-x-3 md:order-4 md:gap-3">
          <StatBar label={en ? "Energy" : "Mermi & Takat"} value={player.energy} max={eMax} />
          <StatBar
            label={en ? "Stamina" : "Racon & Karizma"}
            value={player.stamina}
            max={sMax}
            tone="muted"
          />
          <StatBar label={en ? "Health" : "Can"} value={player.health} max={100} tone="danger" />
          <StatBar
            label={en ? "Heat" : "Emniyet"}
            value={player.isi}
            max={HEAT_MAX}
            tone={player.isi >= 45 ? "danger" : "muted"}
          />
        </div>

        {locked ? (
          <p className="order-3 text-sm text-danger md:order-5">
            {player.durum === "nezaret"
              ? `Nezarethanedesin. ${formatTicksAsMinutes(player.durumTick)} kaldı — saati geçir veya rüşvet ver.`
              : player.durum === "klinik"
                ? `Kliniktesin. ${formatTicksAsMinutes(player.durumTick)}. Doktor bırakana kadar iş yok.`
                : "Can 20'nin altında. Komadasın sayılır — klinik şart."}
          </p>
        ) : player.isi >= 55 ? (
          <p className="order-3 text-sm text-warn md:order-5">
            Emniyet yüksek. Devriye ve rakip semti tarar. Kasaya yatırmadıysan
            cebin açık.
          </p>
        ) : null}

        <div className="order-4 flex flex-wrap items-center gap-2 md:order-3">
          <SaveSlotsPanel />
          <Button variant="ghost" className={CTRL_BTN} onClick={toggleHiz}>
            {en ? "Speed" : "Hız"} ×{hiz}
          </Button>
          <Button variant="ghost" className={CTRL_BTN} onClick={skipHour}>
            {en ? "Pass 1 hour" : "1 saat geçir"}
          </Button>
          <Button
            variant="ghost"
            className={CTRL_BTN}
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((v) => !v)}
          >
            {en ? "Details" : "Detay"}
            <ChevronDown
              className={cn(
                "transition-transform duration-[var(--motion-quick)]",
                detailOpen && "rotate-180",
              )}
            />
          </Button>
          <span className="hidden md:inline-flex">
            <ResetConfirm />
          </span>
        </div>

        <div
          className={cn(
            "hud-chips order-5 flex-col gap-3 md:order-2",
            detailOpen ? "flex" : "hidden",
          )}
        >
          <p className="text-sm text-fg md:hidden">{loadout}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Chip label={en ? "District" : "Semt"} value={HOOD[player.neighborhood]} />
            <Chip
              label={en ? "Rank" : "Kıdem"}
              value={`${player.level} · ${player.xp}/${xpToNext(player.level)} XP`}
            />
            <Chip
              label={en ? "Season" : "Sezon"}
              value={`${dayInSeason}/${SEASON_DAYS} · ${Math.round(player.seasonScore)} skor`}
            />
            <Chip label={en ? "Time" : "Saat"} value={formatClock(player)} accent />
            <Chip label={en ? "Bank" : "Kasa"} value={formatTRY(player.bank)} />
            <Chip label={en ? "Investments" : "Yatırım"} value={formatTRY(yatirim)} />
            <Chip label={en ? "Reputation" : "İtibar"} value={`${Math.round(player.itibar)}`} />
            <Chip label={en ? "Bribe fund" : "Rüşvet"} value={formatTRY(player.rusvet)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <HelpPanel triggerClassName={CTRL_BTN} />
            <span className="md:hidden">
              <ResetConfirm />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Chip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-2">
      <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${accent ? "text-accent" : "text-fg"}`}
      >
        {value}
      </p>
    </div>
  );
}
