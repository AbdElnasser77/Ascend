import { addDays } from "../lib/dates";

type Props = {
  today: string;
  journeyStart: string;
  selected: string;
  onSelect: (iso: string) => void;
  scoreFor: (iso: string) => number;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const R = 13;
const CIRC = 2 * Math.PI * R;

/** Current week, Sun–Sat. Each ring fills with that day's completion. Tap to open the day. */
export function WeekStrip({ today, journeyStart, selected, onSelect, scoreFor }: Props) {
  const [y, m, d] = today.split("-").map(Number);
  const sunday = addDays(today, -new Date(y, m - 1, d).getDay());

  return (
    <div className="week">
      {DAY_NAMES.map((name, i) => {
        const iso = addDays(sunday, i);
        const score = iso <= today ? scoreFor(iso) : 0;
        const before = iso < journeyStart;
        const cls = [
          "week-day",
          iso === today && "today",
          iso === selected && "selected",
          iso > today && "future",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={iso}
            className={cls}
            disabled={before}
            onClick={() => onSelect(iso)}
            aria-pressed={iso === selected}
            aria-label={`${name} ${iso}, ${Math.round(score * 100)}% done`}
          >
            <span className="week-name">{name}</span>
            <span className="week-num">{Number(iso.slice(8))}</span>
            <svg width="34" height="34" viewBox="0 0 34 34" className="ring" aria-hidden="true">
              <circle cx="17" cy="17" r={R} className="ring-bg" />
              {score > 0 && (
                <circle
                  cx="17"
                  cy="17"
                  r={R}
                  className={`ring-fg ${score >= 1 ? "full" : ""}`}
                  strokeDasharray={`${CIRC * score} ${CIRC}`}
                  transform="rotate(-90 17 17)"
                />
              )}
              {score >= 1 && (
                <path d="m11.5 17.5 3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
