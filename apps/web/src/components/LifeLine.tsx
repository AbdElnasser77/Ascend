import { Star } from "./Star";

type Props = {
  age: number;
  journeyDay: number;
  bornLabel: string;
  todayLabel: string;
  /** "Future you": where the line is heading. Without it, the rest is unwritten. */
  future?: { statement: string | null; years: number | null } | null;
};

/**
 * Your life as one line that starts today: you are at the start, and it runs toward the person you want to become.
 * Nobody knows how long the line is, so it has no end date.
 */
export function LifeLine({ age, journeyDay, bornLabel, todayLabel, future }: Props) {
  const statement = future?.statement ?? null;
  const ahead = future?.years ? `By age ${age + future.years}` : "Future you";

  return (
    <div
      className="lifeline"
      role="img"
      aria-label={`Born ${bornLabel}. Today, ${todayLabel}, you are ${age}: day ${journeyDay} of your ascent. ${
        statement ? `${ahead}, you are someone who ${statement}.` : "The rest is still unwritten."
      }`}
    >
      <div className="lifeline-marker at-start">
        <div className="marker-label">
          <span>You are here</span>
          <strong>Day {journeyDay}</strong>
        </div>
        <div className="marker-stem" />
      </div>

      <div className={`lifeline-track open ${statement ? "has-future" : ""}`}>
        <span className="lifeline-star" style={{ left: 0 }}>
          <Star size={22} />
        </span>
        {statement && <span className="lifeline-future-dot" aria-hidden="true" />}
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
        {statement ? (
          <div className="right lifeline-future">
            <span className="end-title">{ahead}</span>
            <span className="end-date">Someone who {statement}</span>
          </div>
        ) : (
          <div className="right">
            <span className="end-title">Still unwritten</span>
            <span className="end-date">The rest is yours to shape</span>
          </div>
        )}
      </div>
    </div>
  );
}
