import { TIERS, evaluateJourney, levelFor, type DayRecord, type JourneyState } from "@ascend/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoalsList, HabitsList, LockedFeature, TasksList } from "../components/DayPlan";
import { JourneyLine } from "../components/JourneyLine";
import { EvolutionCard, LevelsModal } from "../components/Levels";
import { PenLine, Target } from "lucide-react";
import { DatePicker } from "../components/DatePicker";
import { FutureChip } from "../components/FutureYou";
import { GOAL_ICON_SET } from "../components/Icons";
import { LifeLine } from "../components/LifeLine";
import { StatsChart } from "../components/StatsChart";
import { WeekStrip } from "../components/WeekStrip";
import { ageOn, daysBetween, formatLong, todayISO } from "../lib/dates";
import type { Future } from "../lib/journey";
import { useJourney } from "../lib/journey";
import { HABIT_ICONS, activeHabits, dayStats, habitSlotsFor, type Goal, type Habit } from "../lib/progress";

const RANGES = [7, 30, 90] as const;

export function Home({ start }: { start: string }) {
  const today = todayISO();
  const { data, actions } = useJourney();
  const { habits, tasks, goals, redeems, habitLog: log } = data;
  const { birthday, startSlots } = data.profile;
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(today);
  const [showLevels, setShowLevels] = useState(false);
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const habitsRef = useRef<HTMLElement>(null);
  const mainGoal = goals.find((g) => g.main && !g.achievedAt);

  const journeyDay = daysBetween(start, today) + 1;

  // ---- the whole progression, replayed from Day 1 (the same engine the API will use) ----
  const state = useMemo(
    () => evaluateJourney({ start, today, habits, habitLog: log, tasks, goals, redeems }),
    [start, today, habits, log, tasks, goals, redeems],
  );
  const series = state.days;
  const selRecord: DayRecord | undefined = series[daysBetween(start, selected)];
  const sel = selRecord ?? { ...dayStats(selected, habits, tasks, log), xp: 0 };
  const streak = activeStreak(series);
  const recent = series.slice(-7).map((s) => s.score);
  const momentum = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const { unlocks } = state;

  const toast = useProgressToast(state, habits);

  // stats for the chosen range, plus change vs. the range before it
  const effectiveRange = unlocks.statsRanges.includes(range) ? range : 7;
  const stats = useMemo(() => {
    const from = Math.max(0, series.length - effectiveRange);
    const window = series.slice(from);
    const prev = series.slice(Math.max(0, from - effectiveRange), from);
    const avg = (xs: DayRecord[]) => (xs.length ? xs.reduce((a, s) => a + s.score, 0) / xs.length : 0);
    return {
      points: window.map((s) => ({ date: s.date, score: s.score })),
      avg: avg(window),
      delta: prev.length ? Math.round((avg(window) - avg(prev)) * 100) : null,
    };
  }, [series, effectiveRange]);

  // ---- mutations: habits are checked on the day; the past is repaired with Second Chance ----
  const mode: "today" | "past" | "future" = selected === today ? "today" : selected < today ? "past" : "future";

  const toggleHabit = actions.toggleHabit;
  const redeem = (habitId: string) => actions.redeem(habitId, selected);

  const todaysHabits = activeHabits(habits, today);
  const habitSlots = habitSlotsFor(unlocks.habitSlots, habits, start, startSlots);
  const addHabit = (name: string) => {
    if (todaysHabits.length >= habitSlots) return;
    actions.addHabit(name);
  };

  // removing keeps history; a habit added and removed on the same day disappears entirely
  const removeHabit = actions.removeHabit;

  const cycleIcon = (id: string) => {
    const h = habits.find((x) => x.id === id);
    if (h) actions.updateHabit(id, { icon: HABIT_ICONS[(HABIT_ICONS.indexOf(h.icon) + 1) % HABIT_ICONS.length] });
  };

  const addTask = (title: string) => actions.addTask(title, selected);
  const { toggleTask, deleteTask } = actions;

  const addGoal = (title: string) => actions.addGoal(title);
  const { achieveGoal, undoGoal, deleteGoal } = actions;

  const selectedLabel =
    selected === today
      ? "Today’s Overview"
      : new Date(selected + "T00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const pct = Math.round(sel.score * 100);
  const daysBack = daysBetween(selected, today);
  const nextSlotAt = levelFor((u) => u.habitSlots > habitSlots);
  const tasksAt = levelFor((u) => u.tasks) ?? 10;
  const goalsAt = levelFor((u) => u.goals) ?? 20;
  const stageAt = (lvl: number) => [...TIERS].reverse().find((t) => t.level <= lvl)!.name;

  return (
    <div className="home">
      <header className="page-header">
        <p className="eyebrow">{formatLong(today)}</p>
        <h1>
          Don’t count the days.
          <br />
          <span className="gradient-text">Make the days count.</span>
        </h1>
        <FutureChip future={data.profile.future} age={birthday ? ageOn(birthday, today) : null} />
        {mainGoal && (
          <MainGoal
            goal={mainGoal}
            onRename={(title) => actions.renameGoal(mainGoal.id, title)}
          />
        )}
      </header>

      {toast && (
        <div className={`progress-toast ${toast.kind}`} role="status">
          {toast.text}
        </div>
      )}

      {!birthday || editing ? (
        <BirthdayForm
          initial={birthday}
          today={today}
          onCancel={birthday ? () => setEditing(false) : undefined}
          onSave={(d) => {
            actions.setBirthday(d);
            setEditing(false);
          }}
        />
      ) : (
        <LifeCard
          birthday={birthday}
          today={today}
          start={start}
          days={series}
          journeyDay={journeyDay}
          habitName={(id) => habits.find((h) => h.id === id)?.name ?? "Habit"}
          future={data.profile.future}
          onEdit={() => setEditing(true)}
        />
      )}

      <div className="dash">
        <div className="dash-main">
          {/* ---- Today's overview ---- */}
          <section className="card">
            <div className="card-head">
              <h2 className="title-icon">
                <span className="ti violet" aria-hidden="true">
                  <CalendarIcon />
                </span>
                {selectedLabel}
              </h2>
              <span className="complete-chip">
                {pct}% Complete
                <Ring value={sel.score} />
              </span>
            </div>

            <div className="overview">
              <div className="ov">
                <span className="ov-icon green">✓</span>
                <div>
                  <strong>{sel.done}</strong>
                  <span>of {sel.total} done</span>
                </div>
              </div>
              <div className="ov">
                <span className="ov-icon emoji">🔥</span>
                <div>
                  <strong>{streak}</strong>
                  <span>Day streak</span>
                </div>
              </div>
              <div className="ov">
                <span className="ov-icon emoji">🏆</span>
                <div>
                  <strong>+{sel.xp}</strong>
                  <span>XP {selected === today ? "today" : "this day"}</span>
                </div>
              </div>
            </div>

            <div className="progress big" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>

            <WeekStrip
              today={today}
              journeyStart={start}
              selected={selected}
              onSelect={setSelected}
              scoreFor={(d) => dayStats(d, habits, tasks, log).score}
            />
          </section>

          {/* ---- Habits ---- */}
          <section className="card" ref={habitsRef}>
            <div className="card-head">
              <h2 className="title-icon">
                <span className="ti violet" aria-hidden="true">
                  <PulseIcon />
                </span>
                Habits
              </h2>
              <span className="muted small">
                {unlocks.secondChances > 0 ? `↺ ${state.secondChancesLeft}/${unlocks.secondChances} Second Chance left · ` : ""}
                Every day ·{" "}
                <a className="card-link" href="#/plan">
                  Manage
                </a>
              </span>
            </div>
            <HabitsList
              mode={mode}
              habits={activeHabits(habits, selected)}
              checked={new Set(log[selected] ?? [])}
              redeemed={new Set(state.redeemed[selected] ?? [])}
              progress={state.habits}
              doneToday={new Set(log[today] ?? [])}
              secondChancesLeft={state.secondChancesLeft}
              canRedeemDay={unlocks.secondChances > 0 && daysBack >= 1 && daysBack <= 2 && selected >= start}
              slots={{ used: todaysHabits.length, max: habitSlots, nextAt: nextSlotAt }}
              onToggle={toggleHabit}
              onRedeem={redeem}
              onAdd={addHabit}
              onRemove={removeHabit}
              onCycleIcon={cycleIcon}
            />
          </section>

          {/* ---- Goals ---- */}
          <section className="card">
            <div className="card-head">
              <h2 className="title-icon">
                <span className="ti violet" aria-hidden="true">
                  <GoalIcon />
                </span>
                Goals
              </h2>
              <span className="muted small">The big wins</span>
            </div>
            {unlocks.goals ? (
              <GoalsList today={today} goals={goals} onAdd={addGoal} onAchieve={achieveGoal} onUndo={undoGoal} onDelete={deleteGoal} />
            ) : (
              <LockedFeature title="Goals" level={goalsAt} stage={stageAt(goalsAt)}>
                Once a habit is forming, you’ll set goals. Each achieved goal is a huge XP boost.
              </LockedFeature>
            )}
          </section>

          {/* ---- Tasks ---- */}
          <section className="card">
            <div className="card-head">
              <h2 className="title-icon">
                <span className="ti violet" aria-hidden="true">
                  <ListIcon />
                </span>
                Tasks
              </h2>
              <span className="muted small">This day only</span>
            </div>
            {unlocks.tasks ? (
              <TasksList
                mode={mode}
                tasks={tasks.filter((t) => t.date === selected)}
                onToggle={toggleTask}
                onAdd={addTask}
                onDelete={deleteTask}
              />
            ) : (
              <LockedFeature title="Tasks" level={tasksAt} stage={stageAt(tasksAt)}>
                First, build the habit of showing up. Keep one habit 7 days in a row and reach Level 10 to plan daily tasks.
              </LockedFeature>
            )}
          </section>
        </div>

        {/* ---- Your evolution ---- */}
        <aside className="dash-side">
          <EvolutionCard state={state} momentum={momentum} onOpen={() => setShowLevels(true)} />
        </aside>
      </div>

      {/* ---- Stats ---- */}
      <section className="card stats-card">
        <div className="stats-main">
          <div className="card-head">
            <h2 className="title-icon">
              <span className="ti violet" aria-hidden="true">
                <BarsIcon />
              </span>
              Your Stats
            </h2>
            <div className="stats-controls">
              {stats.delta !== null && (
                <span className={`delta ${stats.delta >= 0 ? "up" : "down"}`}>
                  {stats.delta >= 0 ? "↗ +" : "↘ "}
                  {stats.delta}%
                </span>
              )}
              <div className="segmented" role="tablist" aria-label="Range">
                {RANGES.map((r) => {
                  const open = unlocks.statsRanges.includes(r);
                  return (
                    <button
                      key={r}
                      role="tab"
                      aria-selected={effectiveRange === r}
                      className={effectiveRange === r ? "on" : ""}
                      disabled={!open}
                      title={open ? undefined : `Unlocks at Level ${levelFor((u) => u.statsRanges.includes(r))}`}
                      onClick={() => setRange(r)}
                    >
                      {open ? "" : "🔒 "}
                      {r}D
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <StatsChart points={stats.points} />
          <p className="muted small">
            Daily completion · average <b>{Math.round(stats.avg * 100)}%</b> over the last {Math.min(effectiveRange, series.length)}{" "}
            {Math.min(effectiveRange, series.length) === 1 ? "day" : "days"}
          </p>
        </div>

        <Encouragement
          delta={stats.delta}
          todayScore={series[series.length - 1]?.score ?? 0}
          onContinue={() => {
            setSelected(today);
            habitsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </section>

      {showLevels && <LevelsModal state={state} onClose={() => setShowLevels(false)} />}
    </div>
  );
}

/** days in a row with something done, ending today (or yesterday while today is still empty) */
function activeStreak(series: DayRecord[]) {
  let i = series.length - 1;
  if (i >= 0 && series[i].done === 0) i--;
  let n = 0;
  for (; i >= 0 && series[i].done > 0; i--) n++;
  return n;
}

/** Celebrates what just happened: an evolution beats a habit milestone beats a level-up. */
function useProgressToast(state: JourneyState, habits: Habit[]) {
  const [toast, setToast] = useState<{ kind: string; text: string } | null>(null);
  const last = state.days[state.days.length - 1];
  const prev = useRef({ level: state.level, tier: state.tier.level, events: last?.events.length ?? 0, date: last?.date });

  useEffect(() => {
    const day = state.days[state.days.length - 1];
    const events = day?.events ?? [];
    const p = prev.current;
    const seen = p.date === day?.date ? p.events : 0;
    let next: { kind: string; text: string } | null = null;

    if (state.tier.level > p.tier) next = { kind: "tier", text: `🦋 You evolved into ${state.tier.name}! ${state.tier.meaning}` };
    else {
      const ms = events.slice(seen).find((e) => e.type === "milestone");
      if (ms?.type === "milestone") {
        const name = habits.find((h) => h.id === ms.habitId)?.name ?? "Habit";
        next = { kind: "milestone", text: `🌱 “${name}” is ${ms.label.toLowerCase()}! +${ms.xp.toLocaleString()} XP` };
      }
    }
    if (!next && state.level > p.level) next = { kind: "level", text: `⬆ Level up! You reached Level ${state.level}` };

    prev.current = { level: state.level, tier: state.tier.level, events: events.length, date: day?.date };
    if (!next) return;
    setToast(next);
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [state, habits]);

  return toast;
}

function Encouragement({ delta, todayScore, onContinue }: { delta: number | null; todayScore: number; onContinue: () => void }) {
  const [icon, title, body] =
    todayScore >= 1
      ? ["👑", "Perfect day!", "Everything done. Your wings grow stronger."]
      : delta === null
        ? ["🌱", "Your journey starts now", "Check off your first habit and start your transformation."]
        : delta >= 5
          ? ["👑", "You’re doing amazing!", "Keep up the great work and reach new heights."]
          : delta > -5
            ? ["🦋", "Steady and strong", "Every change starts in the cocoon."]
            : ["🌙", "Every butterfly rests", "Pick one habit today and get back on track."];

  return (
    <div className="encourage">
      <span className="encourage-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="encourage-title">{title}</p>
      <p className="muted center">{body}</p>
      <button className="primary-btn" onClick={onContinue}>
        Continue your journey →
      </button>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(167,139,250,.2)" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        transform="rotate(-90 12 12)"
      />
      <defs>
        <linearGradient id="ring-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#8b3fe0" />
          <stop offset="1" stopColor="#c8a2ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const PulseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13h4l3-8 4 14 3-6h4" />
  </svg>
);
const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
const GoalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
  </svg>
);
const BarsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="11" width="4" height="10" rx="1.5" />
    <rect x="10" y="4" width="4" height="17" rx="1.5" />
    <rect x="17" y="8" width="4" height="13" rx="1.5" />
  </svg>
);

function LifeCard({
  birthday,
  today,
  start,
  days,
  journeyDay,
  habitName,
  future,
  onEdit,
}: {
  birthday: string;
  today: string;
  start: string;
  days: DayRecord[];
  journeyDay: number;
  habitName: (id: string) => string;
  future: Future;
  onEdit: () => void;
}) {
  const [view, setView] = useState<"journey" | "life">("journey");
  const age = ageOn(birthday, today);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>This is your life.</h2>
          <p className="muted">
            You are <strong className="age">{age} years old</strong>
            {view === "journey" && (
              <>
                {" "}· Day <strong className="age">{journeyDay}</strong> of your ascent
              </>
            )}
            .
          </p>
        </div>
        <div className="life-actions">
          <div className="segmented" role="tablist" aria-label="Life line view">
            <button role="tab" aria-selected={view === "journey"} className={view === "journey" ? "on" : ""} onClick={() => setView("journey")}>
              Journey
            </button>
            <button role="tab" aria-selected={view === "life"} className={view === "life" ? "on" : ""} onClick={() => setView("life")}>
              Whole life
            </button>
          </div>
          <button className="ghost-btn" onClick={onEdit}>
            Edit birthday
          </button>
        </div>
      </div>

      {view === "journey" ? (
        <JourneyLine start={start} today={today} days={days} habitName={habitName} />
      ) : (
        <LifeLine age={age} journeyDay={journeyDay} bornLabel={formatLong(birthday)} todayLabel={formatLong(today)} future={future} />
      )}
    </section>
  );
}

function MainGoal({ goal, onRename }: { goal: Goal; onRename: (title: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const Icon = goal.kind ? GOAL_ICON_SET[goal.kind] : Target;

  if (draft !== null)
    return (
      <form
        className="main-goal editing"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim().length >= 3) onRename(draft.trim());
          setDraft(null);
        }}
      >
        <Icon size={16} className="main-goal-icon" aria-hidden="true" />
        <input
          aria-label="Your goal"
          value={draft}
          maxLength={90}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
        />
        <button type="submit" className="primary-btn small" disabled={draft.trim().length < 3}>
          Save
        </button>
        <button type="button" className="ghost-btn small" onClick={() => setDraft(null)}>
          Cancel
        </button>
      </form>
    );

  return (
    <p className="main-goal">
      <Icon size={16} className="main-goal-icon" aria-hidden="true" />
      <span className="muted">Your goal:</span> <strong>{goal.title}</strong>
      <button type="button" className="main-goal-edit" onClick={() => setDraft(goal.title)} aria-label="Edit your goal" title="Edit your goal">
        <PenLine size={14} aria-hidden="true" />
      </button>
    </p>
  );
}

function BirthdayForm({
  initial,
  today,
  onSave,
  onCancel,
}: {
  initial: string | null;
  today: string;
  onSave: (d: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial ?? "");

  return (
    <section className="card setup-card">
      <h2>When were you born?</h2>
      <p className="muted">We use it to map your life. Your Day 1 stays the same.</p>
      <form
        className="setup-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onSave(value);
        }}
      >
        <DatePicker value={value} max={today} onChange={setValue} label="Your birthday" />
        <button type="submit" className="primary-btn" disabled={!value}>
          Save
        </button>
        {onCancel && (
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </form>
    </section>
  );
}
