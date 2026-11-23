import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { addDays, formatLong } from "../lib/dates";

type View = "days" | "months" | "years";
type Props = {
  value: string;
  onChange: (iso: string) => void;
  /** latest selectable day, "YYYY-MM-DD" */
  max: string;
  min?: string;
  /** with no value yet, open on the year page this many years before `max` */
  yearsBack?: number;
  label?: string;
};

const YEARS_PER_PAGE = 12;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};

const MONTHS_LONG = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }));
const MONTHS_SHORT = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" }));
// 1 Jan 2023 was a Sunday
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }));
const WEEKDAYS_LONG = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "long" }));

/**
 * Year → month → day picker, built for dates far in the past (like a birthday):
 * three taps instead of scrolling back month by month.
 */
export function DatePicker({ value, onChange, max, min = "1900-01-01", yearsBack = 25, label = "Choose a date" }: Props) {
  const lo = parse(min);
  const hi = parse(max);
  const start = value ? parse(value) : { y: hi.y - yearsBack, m: 0, d: 1 };

  const [view, setView] = useState<View>(value ? "days" : "years");
  const [y, setY] = useState(start.y);
  const [m, setM] = useState(start.m);
  const [focusDate, setFocusDate] = useState(value || iso(start.y, start.m, 1));
  const [motion, setMotion] = useState<"next" | "prev" | "zoom">("zoom");
  const gridRef = useRef<HTMLDivElement>(null);
  const fromKeyboard = useRef(false);

  // after arrow-key navigation, move real focus onto the new day
  useEffect(() => {
    if (!fromKeyboard.current) return;
    fromKeyboard.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  });

  const pageStart = Math.floor(y / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  const ym = y * 12 + m;

  const canPrev = view === "days" ? ym > lo.y * 12 + lo.m : view === "months" ? y > lo.y : pageStart > lo.y;
  const canNext = view === "days" ? ym < hi.y * 12 + hi.m : view === "months" ? y < hi.y : pageStart + YEARS_PER_PAGE - 1 < hi.y;

  const step = (dir: 1 | -1) => {
    setMotion(dir > 0 ? "next" : "prev");
    if (view === "days") {
      const n = ym + dir;
      setY(Math.floor(n / 12));
      setM(n % 12);
    } else setY(y + dir * (view === "months" ? 1 : YEARS_PER_PAGE));
  };

  const zoomTo = (v: View) => {
    setMotion("zoom");
    setView(v);
  };

  const pick = (date: string) => {
    setFocusDate(date);
    onChange(date);
  };

  const onDaysKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const by = moves[e.key];
    if (by === undefined) return;
    e.preventDefault();
    let next = addDays(focusDate, by);
    if (next > max) next = max;
    if (next < min) next = min;
    const p = parse(next);
    if (p.y !== y || p.m !== m) {
      setMotion(next > focusDate ? "next" : "prev");
      setY(p.y);
      setM(p.m);
    }
    fromKeyboard.current = true;
    setFocusDate(next);
  };

  const title =
    view === "days" ? `${MONTHS_LONG[m]} ${y}` : view === "months" ? String(y) : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;

  let body;
  if (view === "years") {
    body = (
      <div className="dp-grid dp-years">
        {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((yr) => (
          <button
            key={yr}
            type="button"
            className={`dp-cell ${value && parse(value).y === yr ? "on" : ""} ${yr === hi.y ? "now" : ""}`}
            disabled={yr < lo.y || yr > hi.y}
            onClick={() => {
              setY(yr);
              zoomTo("months");
            }}
          >
            {yr}
          </button>
        ))}
      </div>
    );
  } else if (view === "months") {
    body = (
      <div className="dp-grid dp-months">
        {MONTHS_SHORT.map((name, i) => {
          const sel = value && parse(value).y === y && parse(value).m === i;
          return (
            <button
              key={name}
              type="button"
              className={`dp-cell ${sel ? "on" : ""}`}
              aria-label={`${MONTHS_LONG[i]} ${y}`}
              disabled={iso(y, i, 1) > max || iso(y, i, daysIn(y, i)) < min}
              onClick={() => {
                setM(i);
                const v = value ? parse(value) : null;
                setFocusDate(v && v.y === y && v.m === i ? value : iso(y, i, 1));
                zoomTo("days");
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    );
  } else {
    const lead = new Date(y, m, 1).getDay();
    const total = daysIn(y, m);
    const dates = Array.from({ length: total }, (_, i) => iso(y, m, i + 1));
    const ok = (d: string) => d >= min && d <= max;
    // exactly one day is reachable with Tab
    const tabDate = [focusDate, value].find((d) => d && dates.includes(d) && ok(d)) ?? dates.find(ok);

    body = (
      <div className="dp-grid dp-days" role="grid" aria-label={title} onKeyDown={onDaysKey}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="dp-wd" aria-hidden="true" title={WEEKDAYS_LONG[i]}>
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {dates.map((d, i) => (
          <button
            key={d}
            type="button"
            className={`dp-cell dp-day ${d === value ? "on" : ""} ${d === max ? "now" : ""}`}
            disabled={!ok(d)}
            tabIndex={d === tabDate ? 0 : -1}
            aria-pressed={d === value}
            aria-label={formatLong(d)}
            onClick={() => pick(d)}
            onFocus={() => setFocusDate(d)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="dp" role="group" aria-label={label}>
      <div className="dp-head">
        <button type="button" className="dp-arrow" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous">
          <ChevronLeft size={18} />
        </button>
        {view === "years" ? (
          <span className="dp-title">{title}</span>
        ) : (
          <button type="button" className="dp-title link" onClick={() => zoomTo(view === "days" ? "months" : "years")}>
            {title}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="dp-arrow" onClick={() => step(1)} disabled={!canNext} aria-label="Next">
          <ChevronRight size={18} />
        </button>
      </div>

      <div ref={gridRef} key={`${view}-${view === "days" ? ym : view === "months" ? y : pageStart}`} className={`dp-body dp-${motion}`}>
        {body}
      </div>

      <div className="dp-foot" aria-live="polite">
        {value ? (
          <>
            <Check size={16} className="dp-check" aria-hidden="true" /> {formatLong(value)}
          </>
        ) : (
          <span className="muted small">
            {view === "years" ? "Pick the year" : view === "months" ? "Now the month" : "And the day"}
          </span>
        )}
        <span className="dp-crumbs" aria-hidden="true">
          <i className={view === "years" ? "on" : ""} />
          <i className={view === "months" ? "on" : ""} />
          <i className={view === "days" ? "on" : ""} />
        </span>
      </div>
    </div>
  );
}
