import { Star } from "./Star";

type Props = {
  age: number;
  journeyDay: number;
  bornLabel: string;
  todayLabel: string;
};

/**
 * Your life as one line that starts today: you are at the start, everything ahead is still unwritten.
 * Nobody knows how long the line is, so it has no end date.
 */
export function LifeLine({ age, journeyDay, bornLabel, todayLabel }: Props) {
  return (
    <div
      className="lifeline"
      role="img"
      aria-label={`Born ${bornLabel}. Today, ${todayLabel}, you are ${age}: day ${journeyDay} of your ascent. The rest is still unwritten.`}
    >
      <div className="lifeline-marker at-start">
        <div className="marker-label">
          <span>You are here</span>
          <strong>Day {journeyDay}</strong>
        </div>
        <div className="marker-stem" />
      </div>

      <div className="lifeline-track open">
        <span className="lifeline-star" style={{ left: 0 }}>
          <Star size={22} />
        </span>
      </div>

      <div className="lifeline-today">
        <span className="today-date align-start" style={{ left: 0 }}>
          {todayLabel}
        </span>
      </div>

      <div className="lifeline-ends">
        <div>
          <span className="end-title">Born</span>
          <span className="end-date">{bornLabel}</span>
        </div>
        <div className="right">
          <span className="end-title">Still unwritten</span>
          <span className="end-date">The rest is yours to shape</span>
        </div>
      </div>
    </div>
  );
}
