import { CalendarClock, ListChecks, LoaderCircle, Play, Target, Telescope } from "lucide-react";
import { useState } from "react";
import { ApiError } from "../lib/api";
import { formatLong } from "../lib/dates";
import { useJourney } from "../lib/journey";
import { activeHabits } from "../lib/progress";
import { HabitIcon } from "./Icons";

/** The dashboard before Day 1, when the journey was set to start tomorrow. */
export function BeforeDayOne({ start, name }: { start: string; name?: string | null }) {
  const { data, actions } = useJourney();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const goal = data.goals.find((g) => g.main && !g.achievedAt);
  const habits = activeHabits(data.habits, start);
  const future = data.profile.future.statement;
  const firstName = name?.trim().split(/\s+/)[0];

  async function startToday() {
    setBusy(true);
    setError(null);
    try {
      await actions.startToday();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t start your journey. Check your connection.");
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <header className="page-header">
        <p className="eyebrow">Day 1 · {formatLong(start)}</p>
        <h1>
          {firstName ? `${firstName}, your` : "Your"} journey
          <br />
          <span className="gradient-text">starts tomorrow.</span>
        </h1>
        <p className="muted">Everything is set. Tomorrow you check off your first day, and the count begins.</p>
      </header>

      <section className="card before-day-one">
        <div className="card-head">
          <h2 className="title-icon">
            <span className="ti violet" aria-hidden="true">
              <CalendarClock size={18} />
            </span>
            Tonight, get ready
          </h2>
        </div>

        <dl className="before-list">
          {future && (
            <div>
              <dt>
                <Telescope size={15} aria-hidden="true" /> Future you
              </dt>
              <dd>Someone who {future}</dd>
            </div>
          )}
          {goal && (
            <div>
              <dt>
                <Target size={15} aria-hidden="true" /> Your goal
              </dt>
              <dd>{goal.title}</dd>
            </div>
          )}
          <div>
            <dt>
              <ListChecks size={15} aria-hidden="true" /> {habits.length > 1 ? "Your habits" : "Your habit"}
            </dt>
            <dd className="before-habits">
              {habits.map((h) => (
                <span key={h.id}>
                  <HabitIcon name={h.icon} size={15} /> {h.name}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <ol className="before-steps">
          <li>Decide when you’ll do {habits.length > 1 ? "each habit" : "it"} tomorrow, and tie it to something you already do.</li>
          <li>Make it easy: put what you need where you’ll see it.</li>
          <li>Tomorrow, do it once and check it off here.</li>
        </ol>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="before-actions">
          <a className="ghost-btn" href="#/plan">
            Adjust your plan
          </a>
          <button type="button" className="primary-btn" onClick={startToday} disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            Start today instead
          </button>
        </div>
      </section>
    </div>
  );
}
