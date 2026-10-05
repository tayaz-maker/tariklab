import { useCallback, useEffect, useRef, useState } from "react";
import { describeOutcomeMoment, type OutcomeMoment } from "@/game/outcome-moment";
import { useLang } from "@/lib/i18n";
import "./outcome-moment.css";

/** Non-modal, silent receipt. Never takes focus; pauses dismissal while read. */
export function OutcomeMomentCard({ moment, onClose }: {
  moment: OutcomeMoment | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const en = lang !== "tr";
  const card = useRef<HTMLElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!moment) return;
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [moment]);
  useEffect(() => {
    if (!moment || reduced || paused) return;
    const timer = window.setTimeout(onClose, 2200);
    return () => window.clearTimeout(timer);
  }, [moment, onClose, reduced, paused]);

  const close = useCallback(() => {
    if (card.current?.contains(document.activeElement)) {
      const target = origin.current?.isConnected && !origin.current.matches(":disabled")
        ? origin.current : card.current.closest("main");
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }
    setHovered(false);
    setFocused(false);
    onClose();
  }, [onClose]);
  useEffect(() => {
    if (!moment) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented &&
        !(document.activeElement instanceof Element && document.activeElement.closest('[role="dialog"]'))) close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [moment, close]);
  const n = (value: number) => new Intl.NumberFormat(en ? "en" : "tr", { maximumFractionDigits: 1 }).format(value);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${n(value)}`;
  const copy = moment ? describeOutcomeMoment(moment, en) : null;
  const announcement = useRef("");
  if (copy) announcement.current = `${copy.summary} ${copy.crewSummary} ${copy.delaySummary}`;
  return <>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement.current}</p>
    {moment ? <section ref={card} className="cete-moment" data-outcome-moment={moment.kind}
      data-reduced-motion={reduced} aria-label={en ? "Decision outcome" : "İcraat sonucu"}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="cete-moment-heading">
        <div><p className="cete-moment-eyebrow">{en ? "OUTCOME LEDGER" : "İCRAAT DEFTERİ"} · {moment.day}. {en ? "DAY" : "GÜN"}</p>
          <h2>{copy?.title}</h2></div>
        <button type="button" onClick={close} aria-label={en ? "Close outcome" : "Sonucu kapat"}>{en ? "Close" : "Kapat"}</button>
      </div>
      <svg className="cete-moment-trace" viewBox="0 0 280 60" aria-hidden="true" focusable="false">
        <g className="cete-moment-links">{moment.layers.links.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="cete-moment-blocks">{moment.layers.blocks.map((b, i) => <rect key={i} x={b.x} y={b.y} width="20" height={b.height} />)}</g>
        <g className="cete-moment-paper"><path d="M224 10H260L270 20V50H224Z M260 10V20H270 M230 29H260 M230 35H253 M230 41H244" /></g>
        <g className="cete-moment-seal"><path d="M248 39L258 33L268 39V49L258 55L248 49Z M253 44L257 48L264 40" /></g>
      </svg>
      <dl className="cete-moment-metrics">
        <div><dt>{en ? "Cash" : "Nakit"}</dt><dd>{signed(moment.cash)} ₺</dd></div>
        <div><dt>{en ? "Reputation" : "İtibar"}</dt><dd>{signed(moment.reputation)}</dd></div>
        <div><dt>{en ? "Pressure" : "Baskı"}</dt><dd>{signed(moment.pressure)}</dd></div>
      </dl>
      <p className="cete-moment-energy">{en ? "Energy balance" : "Enerji bakiyesi"}: {signed(moment.energy)}</p>
      <p className="cete-moment-detail">{copy?.crewSummary}</p>
      <p className="cete-moment-detail">{copy?.delaySummary}</p>
      <p className="cete-moment-foot">{en ? "Snapshot at completion · clock keeps running" : "Tamamlanma anı · oyun saati ilerlemeye devam eder"}</p>
    </section> : null}
  </>;
}
