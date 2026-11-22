import type { DayRecord, Tier } from "@ascend/shared";
import type { CSSProperties } from "react";
import { addDays } from "../lib/dates";
import { Star } from "./Star";

type Props = {
  start: string;
  today: string;
  /** one entry per day from Day 1 through today */
  days: DayRecord[];
  /** habit id → name, for marker labels */
  habitName: (id: string) => string;
};

type Milestone = { day: number; level: number; tier?: Tier };
type Mark = { day: number; kind: "goal" | "habit"; title: string };

const short = (iso: string) =>
  new Date(iso + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * Your journey from Day 1 to today, and onward.
 * Every day gets a tick: violet for habits done, cyan for tasks done, taller = more done.
 * Level-ups sit on the line; new stages get a gold star and their name;
 * achieved goals and established habits get their own markers.
 */
export function JourneyLine({ start, today, days, habitName }: Props) {
  const n = days.length;
  const ahead = Math.max(7, Math.ceil(n * 0.15)); // the line keeps going past today
  const span = n + ahead;
  const pos = (i: number) => ((i + 0.5) / span) * 100;
  const todayPct = pos(n - 1);
  const maxItems = Math.max(1, ...days.map((d) => d.habitsDone + d.tasksDone));
  const tickW = `clamp(2px, calc(${100 / span}% * 0.35), 4px)`;

  // the engine already recorded every level-up, evolution, goal and habit milestone
  const milestones: Milestone[] = [];
  const marks: Mark[] = [];
  days.forEach((d, i) => {
    let level = 0;
    let tier: Tier | undefined;
    for (const e of d.events) {
      if (e.type === "level") level = e.level;
      if (e.type === "tier") tier = e.tier;
      if (e.type === "goal") marks.push({ day: i, kind: "goal", title: `Day ${i + 1}: goal achieved` });
      if (e.type === "milestone" && e.milestone !== "hatched" && e.milestone !== "forming")
        marks.push({ day: i, kind: "habit", title: `Day ${i + 1}: “${habitName(e.habitId)}” ${e.label.toLowerCase()} (+${e.xp.toLocaleString()} XP)` });
    }
    if (level) milestones.push({ day: i, level, tier });
  });

  const totals = days.reduce((a, d) => ({ habits: a.habits + d.habitsDone, tasks: a.tasks + d.tasksDone }), { habits: 0, tasks: 0 });
  const ranks = milestones.filter((m) => m.tier).length;
  const goals = marks.filter((m) => m.kind === "goal").length;
  const align = todayPct < 12 ? "start" : todayPct > 88 ? "end" : "center";

  return (
    <div className="journey">
      <div className="journey-track-area">
        {/* today marker */}
        <div className={`journey-marker align-${align}`} style={{ left: `${todayPct}%` }}>
          <div className="marker-label">
            <span>You are here</span>
            <strong>Day {n}</strong>
          </div>
          <div className="journey-stem" />
        </div>

        {/* daily ticks */}
        <div className="journey-ticks">
          {days.map((d, i) => {
            const total = d.habitsDone + d.tasksDone;
            if (!total) return null;
            const h = 18 + (total / maxItems) * 46;
            return (
              <div
                key={i}
                className="jt"
                style={{ left: `${pos(i)}%`, width: tickW, height: h } as CSSProperties}
                title={`Day ${i + 1} · ${short(addDays(start, i))}: ${d.habitsDone} habit${d.habitsDone === 1 ? "" : "s"}, ${d.tasksDone} task${d.tasksDone === 1 ? "" : "s"}`}
              >
                <span className="jt-task" style={{ flexGrow: d.tasksDone }} />
                <span className="jt-habit" style={{ flexGrow: d.habitsDone }} />
              </div>
            );
          })}
        </div>

        {/* the line */}
        <div className="journey-track">
          <div className="journey-fill" style={{ width: `${todayPct}%` }} />

          {milestones.map((m) =>
            m.tier ? (
              <span key={m.level} className="jm rank" style={{ left: `${pos(m.day)}%` }} title={`Day ${m.day + 1}: evolved into ${m.tier.name} (Level ${m.level})`}>
                <Star size={14} />
              </span>
            ) : (
              <span key={m.level} className="jm level" style={{ left: `${pos(m.day)}%` }} title={`Day ${m.day + 1}: Level ${m.level}`} />
            ),
          )}

          {marks.map((m, i) => (
            <span key={`m${i}`} className={`jm ${m.kind}`} style={{ left: `${pos(m.day)}%` }} title={m.title} />
          ))}

          <span className="journey-star" style={{ left: `${todayPct}%` }}>
            <Star size={22} />
          </span>
        </div>

        {/* rank names under the line */}
        <div className="journey-ranks">
          {milestones
            .filter((m) => m.tier)
            .map((m) => (
              <span key={m.level} style={{ left: `${pos(m.day)}%` }}>
                {m.tier!.name}
              </span>
            ))}
        </div>
      </div>

      <div className="lifeline-ends">
        <div>
          <span className="end-title">Day 1</span>
          <span className="end-date">{short(start)}</span>
        </div>
        <div className="journey-totals">
          <span>
            <b>{totals.habits}</b> habits
          </span>
          <span>
            <b>{totals.tasks}</b> tasks
          </span>
          <span>
            <b>{goals}</b> {goals === 1 ? "goal" : "goals"}
          </span>
          <span>
            <b>{ranks}</b> {ranks === 1 ? "evolution" : "evolutions"}
          </span>
        </div>
        <div className="right">
          <span className="end-title">Today</span>
          <span className="end-date">{short(today)}</span>
        </div>
      </div>

      <div className="dl-legend">
        <span>
          <i className="lg habit" /> Habits done
        </span>
        <span>
          <i className="lg task" /> Tasks done
        </span>
        <span>
          <i className="lg rank" /> Evolved
        </span>
        <span>
          <i className="lg goal" /> Goal achieved
        </span>
        <span>
          <i className="lg habitms" /> Habit established
        </span>
        <span>
          <i className="lg level" /> Level up
        </span>
      </div>
    </div>
  );
}
