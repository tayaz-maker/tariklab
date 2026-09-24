import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  CREW_MAP,
  ESTATE_MAP,
  HOOD_IDS,
  ITEM_MAP,
  KOSE_TIERS,
  MARKET_START,
  PARTNER_MAP,
  SEASON_DAYS,
  hoodName,
  ihanetSeviye,
  koseDaysLeft,
  ledger,
  tefeciKrediNotu,
  toplamOrtalik,
} from "@/game/data";
import { energyMax, lakap, staminaMax, xpToNext } from "@/game/formulas";
import {
  fetchLeaderboard,
  type BoardRow,
} from "@/game/leaderboard-server";
import { ACHIEVEMENTS } from "@/game/meta";
import { useGame } from "@/game/store";
import type { NeighborhoodId, Player } from "@/game/types";
import { track } from "@/lib/analytics";
import { formatTRY } from "@/lib/utils";

const HOOD: Record<NeighborhoodId, string> = {
  eyup: "Eyüp",
  tarlabasi: "Tarlabaşı",
  kadikoy: "Kadıköy",
  sultangazi: "Sultangazi",
};

const LOCAL_BOARD: BoardRow[] = [
  { name: "Piranha Orhan", score: 420, hood: "eyup" },
  { name: "Haydar Usta", score: 310, hood: "kadikoy" },
  { name: "Cemile Ablası", score: 240, hood: "tarlabasi" },
  { name: "Sultan Gazi", score: 180, hood: "sultangazi" },
  { name: "Kambur Rıza", score: 90, hood: "eyup" },
];

let boardCache: BoardRow[] | null = null;
let boardInflight: Promise<BoardRow[]> | null = null;

function loadBoard() {
  if (boardCache) return Promise.resolve(boardCache);
  if (boardInflight) return boardInflight;
  boardInflight = fetchLeaderboard()
    .then((rows) => {
      boardCache = rows.length ? rows : LOCAL_BOARD;
      return boardCache;
    })
    .catch(() => {
      boardCache = LOCAL_BOARD;
      return boardCache;
    })
    .finally(() => {
      boardInflight = null;
    });
  return boardInflight;
}

export function MePanel({ player }: { player: Player }) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const market = useGame((s) => s.market) ?? MARKET_START;
  const logs = useGame((s) => s.logs);
  const savedAt = useGame((s) => s.savedAt);
  const L = ledger(player, market);
  const eMax = energyMax(player.level, player.neighborhood);
  const sMax = staminaMax(player.level);
  const dayInSeason = Math.min(
    SEASON_DAYS,
    Math.max(1, player.gun - (player.seasonGun || 1) + 1),
  );
  const loadout = [
    player.equippedWeapon ? ITEM_MAP[player.equippedWeapon]?.name : null,
    player.equippedArmor ? ITEM_MAP[player.equippedArmor]?.name : null,
    player.equippedVehicle ? ITEM_MAP[player.equippedVehicle]?.name : null,
  ].filter(Boolean) as string[];
  const luxury = player.inventory
    .map((id) => ITEM_MAP[id])
    .filter((i) => i?.kind === "luxury")
    .map((i) => i.name);
  const bag = player.inventory
    .map((id) => ITEM_MAP[id]?.name)
    .filter(Boolean) as string[];
  const rels = Object.entries(player.relations ?? {})
    .filter(([, v]) => v > 0)
    .map(([id, v]) => `${PARTNER_MAP[id]?.name ?? id} ${Math.round(v)}`);
  const have = new Set(player.achievements ?? []);
  const [board, setBoard] = useState<BoardRow[]>(LOCAL_BOARD);
  const spark = useMemo(() => sparkFromLogs(logs, player.cash), [logs, player.cash]);

  useEffect(() => {
    let live = true;
    void loadBoard().then((rows) => {
      if (!live) return;
      setBoard(rows);
    });
    track("liderlik_goruldu");
    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => {
    const mine: BoardRow = {
      name: player.name,
      score: Math.round(player.seasonScore),
      hood: player.neighborhood,
    };
    const list = board.some((r) => r.name === player.name)
      ? board.map((r) => (r.name === player.name ? mine : r))
      : [...board, mine];
    return [...list].sort((a, b) => b.score - a.score).slice(0, 20);
  }, [board, player.name, player.seasonScore, player.neighborhood]);

  const rank = rows.findIndex((r) => r.name === player.name) + 1;
  const invite =
    typeof window !== "undefined"
      ? `${window.location.origin}/cete-savaslari?ref=${encodeURIComponent(player.name)}`
      : "";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_rgba(239,232,222,0.08)]">
        <h2 className="font-display text-2xl font-semibold">{en ? "Me" : "Ben"}</h2>
        <p className="mt-1 text-sm text-muted">
          {player.name} · {lakap(player.level)} · {HOOD[player.neighborhood]}
        </p>
        <p className="mt-2 text-sm text-fg">
          {en ? "Level" : "Kıdem"} {player.level} · {player.xp}/{xpToNext(player.level)} XP ·{" "}
          {en ? "season" : "sezon"}{" "}
          {dayInSeason}/{SEASON_DAYS} · {Math.round(player.seasonScore)} {en ? "score" : "skor"}
        </p>
        <p className="mt-2 text-sm text-fg">
          {en ? "Status" : "Durum"}:{" "}
          {player.durum === "serbest"
            ? (en ? "free" : "serbest")
            : player.durum === "nezaret"
              ? `${en ? "holding cell" : "nezaret"} (${player.durumTick * 10} ${en ? "min" : "dk"})`
              : `${en ? "clinic" : "klinik"} (${player.durumTick * 10} ${en ? "min" : "dk"})`}
        </p>
        <p className="mt-2 text-sm text-muted">
          {en ? "Daily streak" : "Günlük seri"} {player.streak || 0}
          {player.streak >= 7 ? (en ? " · 7-day achievement unlocked" : " · 7 günlük başarım açık") : ""} ·{" "}
          {en ? "last saved" : "son kayıt"}{" "}
          {savedAt
            ? new Date(savedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : (en ? "never" : "yok")}
        </p>
        <p className="mt-2 text-sm text-fg md:hidden">
          {loadout.join(" · ") || (en ? "Nothing equipped" : "Üst boş")}
        </p>
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">{en ? "Rank" : "Sıra"}</h3>
        <p className="mt-1 text-sm text-muted">
          {en
            ? "Season score. First place's title: father of Istanbul."
            : "Sezon skoru. Birinci unvanı: İstanbul'un babası."}
          {rank ? ` ${en ? "You:" : "Sen:"} ${rank}.` : ""}
        </p>
        <ol className="mt-3 space-y-1">
          {rows.slice(0, 10).map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                r.name === player.name ? "bg-elevated text-fg" : "text-muted"
              }`}
            >
              <span>
                {i + 1}. {r.name}
                {i === 0 ? (en ? " · father of Istanbul" : " · İstanbul'un babası") : ""}
              </span>
              <span className="font-mono tabular-nums text-fg">
                {Math.round(r.score)}
              </span>
            </li>
          ))}
        </ol>
        <Sparkline points={spark} />
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">{en ? "Achievements" : "Başarımlar"}</h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => (
            <li
              key={a.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                have.has(a.id) ? "bg-elevated text-fg" : "text-muted"
              }`}
            >
              {have.has(a.id) ? a.label : `${a.label} · ${en ? "locked" : "kilitli"}`}
            </li>
          ))}
        </ul>
        {have.size && typeof navigator !== "undefined" && "share" in navigator ? (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              void navigator.share?.({
                title: "Çete Savaşları",
                text: `${player.name} · ${[...have].length} ${en ? "achievements" : "başarım"} · ${en ? "score" : "skor"} ${Math.round(player.seasonScore)}`,
                url: invite || window.location.href,
              });
            }}
          >
            {en ? "Share" : "Paylaş"}
          </Button>
        ) : null}
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">{en ? "Invite" : "Davet"}</h3>
        <p className="mt-2 text-sm text-muted">
          {en
            ? "Your name is your code. After the first job, both of you get ₺5,000, once."
            : "Kodun lakabın. İlk işten sonra ikinize 5.000 ₺, bir kez."}
        </p>
        <p className="mt-2 break-all font-mono text-xs text-fg">{invite}</p>
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">Maddi</h3>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Cell k="Nakit" v={formatTRY(L.nakit)} />
          <Cell k="Kasa" v={formatTRY(L.kasa)} />
          <Cell k="Rüşvet" v={formatTRY(L.rusvet)} />
          <Cell k="Altın" v={`${player.altin.toLocaleString("tr-TR")} g`} />
          <Cell k="Dolar" v={`$${player.usd.toLocaleString("tr-TR")}`} />
          <Cell k="USDT" v={`${player.usdt.toLocaleString("tr-TR")} ₮`} />
          <Cell k="Portföy" v={formatTRY(L.port)} />
          <Cell k="Emlak değeri" v={formatTRY(L.emlakDeger)} />
          <Cell k="Köşe" v={formatTRY(L.koseDeger)} />
          <Cell k="Toplam varlık" v={formatTRY(L.varlik)} accent />
        </ul>
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">Gelir / gider</h3>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Cell k="Emlak / saat" v={formatTRY(L.emlakSaat)} />
          <Cell k="Haraç / saat" v={formatTRY(L.haracSaat)} />
          <Cell k="Çete maaşı / saat" v={`−${formatTRY(L.ceteSaat)}`} />
          <Cell k="Çocuk / saat" v={`−${formatTRY(L.cocukSaat)}`} />
          <Cell k="Net / saat" v={formatTRY(L.netSaat)} accent />
          <Cell
            k="Köşe / hafta"
            v={
              player.kose
                ? `${formatTRY(L.koseHafta)} · ${koseDaysLeft(player)} gün`
                : "yok"
            }
          />
          <Cell k="Net / hafta" v={formatTRY(L.netHafta)} accent />
        </ul>
        {player.kose ? (
          <p className="mt-3 text-sm text-muted">
            {KOSE_TIERS[player.kose - 1].name}
            {player.neighborhood === "tarlabasi" ? " · Tarlabaşı +20%" : ""}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">Manevi</h3>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Cell k="İtibar" v={`${Math.round(player.itibar)}`} />
          <Cell k="Emniyet" v={`${Math.round(player.isi)} / 100`} />
          <Cell
            k="Sağlık izi"
            v={player.saglikIzi > 0 ? `${player.saglikIzi * 10} dk` : "yok"}
          />
          <Cell k="Tefeci notu" v={`${tefeciKrediNotu(player)}`} />
          <Cell k="Ortalıklık" v={`${toplamOrtalik(player)}`} />
          <Cell k="İhanet" v={ihanetSeviye(player)} />
          <Cell k="Can" v={`${Math.round(player.health)} / 100`} />
          <Cell k="Mermi" v={`${Math.round(player.energy)} / ${eMax}`} />
          <Cell k="Racon" v={`${Math.round(player.stamina)} / ${sMax}`} />
          <Cell
            k="Aile"
            v={
              player.married
                ? `${player.spouse ?? "evli"} · ${player.kids} çocuk`
                : player.girlfriend
                  ? PARTNER_MAP[player.girlfriend]?.name ?? "sevgili"
                  : "yalnız"
            }
          />
        </ul>
        {rels.length ? (
          <p className="mt-3 text-sm text-fg">İlişki: {rels.join(" · ")}</p>
        ) : null}
        {player.horse ? (
          <p className="mt-2 text-sm text-fg">
            At: {player.horse.name} · hız {Math.round(player.horse.speed)} · form{" "}
            {Math.round(player.horse.form)}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="font-display text-xl font-semibold">Sahiplik</h3>
        <p className="mt-2 text-sm text-fg">
          Üst: {loadout.length ? loadout.join(" · ") : "boş"}
        </p>
        <p className="mt-2 text-sm text-muted">
          Çanta: {bag.length ? bag.join(" · ") : "boş"}
        </p>
        {luxury.length ? (
          <p className="mt-2 text-sm text-fg">Lüks: {luxury.join(" · ")}</p>
        ) : null}
        <p className="mt-2 text-sm text-fg">
          İş / konut:{" "}
          {player.properties.length
            ? player.properties
                .map((id) => ESTATE_MAP[id]?.name)
                .filter(Boolean)
                .join(" · ")
            : "yok"}
        </p>
        <p className="mt-2 text-sm text-fg">
          Çete:{" "}
          {player.crew.length
            ? player.crew.map((id) => CREW_MAP[id]?.name).join(" · ")
            : "yalnız çalışıyorsun"}
        </p>
        <p className="mt-2 text-sm text-fg">
          Semt:{" "}
          {HOOD_IDS.map(
            (id) => `${hoodName(id)} ${Math.round(player.turf[id] ?? 0)}%`,
          ).join(" · ")}
        </p>
        {player.senet ? (
          <p className="mt-2 text-sm text-warn">
            Senet {player.senet.kind === "borc" ? "borç" : "alacak"} ·{" "}
            {player.senet.name} · {formatTRY(player.senet.amount)} · gün{" "}
            {player.senet.dueGun}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 120;
      const y = 28 - ((v - min) / span) * 24;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className="mt-3 h-8 w-full text-accent"
      viewBox="0 0 120 32"
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function sparkFromLogs(
  logs: { moneyDelta?: number }[],
  cash: number,
): number[] {
  const deltas = logs
    .filter((l) => typeof l.moneyDelta === "number" && l.moneyDelta)
    .slice(0, 16)
    .map((l) => l.moneyDelta as number)
    .reverse();
  if (!deltas.length) return [cash];
  let v = cash - deltas.reduce((a, b) => a + b, 0);
  const out = [v];
  for (const d of deltas) {
    v += d;
    out.push(v);
  }
  return out;
}

function Cell({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <li className="rounded-lg bg-elevated px-3 py-2">
      <p className="text-xs font-medium text-muted">{k}</p>
      <p
        className={`mt-0.5 font-mono text-sm font-medium tabular-nums ${accent ? "text-accent" : "text-fg"}`}
      >
        {v}
      </p>
    </li>
  );
}
