import { Star } from "./Star";

type Props = {
  pct: number;
  journeyDay: number;
  bornLabel: string;
  todayLabel: string;
  endLabel: string;
};

/** Your whole life as one line, with a marker on today and dates underneath. */
export function LifeLine({ pct, journeyDay, bornLabel, todayLabel, endLabel }: Props) {
  const p = Math.min(100, Math.max(0, pct));
  // keep the today-date label inside the line near either end
  const align = p < 15 ? "start" : p > 85 ? "end" : "center";

  return (
    <div className="lifeline" role="img" aria-label={`${p.toFixed(1)}% of life lived. Today is day ${journeyDay}.`}>
      <div className="lifeline-marker" style={{ left: `${p}%` }}>
        <div className="marker-label">
          <span>You are here</span>
          <strong>Day {journeyDay}</strong>
        </div>
        <div className="marker-stem" />
      </div>

      <div className="lifeline-track">
        <div className="lifeline-fill" style={{ width: `${p}%` }} />
        <span className="lifeline-star" style={{ left: `${p}%` }}>
          <Star size={22} />
        </span>
      </div>

      <div className="lifeline-today">
        <span className={`today-date align-${align}`} style={{ left: `${p}%` }}>
          {todayLabel}
        </span>
      </div>

      <div className="lifeline-ends">
        <div>
          <span className="end-title">Born</span>
          <span className="end-date">{bornLabel}</span>
        </div>
        <div className="right">
          <span className="end-title">Age 80</span>
          <span className="end-date">{endLabel}</span>
        </div>
      </div>
    </div>
  );
}
