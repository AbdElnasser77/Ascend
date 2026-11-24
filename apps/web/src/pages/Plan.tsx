import { TIERS, evaluateJourney, levelFor } from "@ascend/shared";
import { Check, Lock, PenLine, Plus, Target, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FutureSection } from "../components/FutureYou";
import { GOAL_ICON_SET, HABIT_ICON_SET, HabitIcon } from "../components/Icons";
import { addDays, ageOn, formatLong, todayISO } from "../lib/dates";
import { useJourney } from "../lib/journey";
import { activeHabits, habitSlotsFor, type Habit } from "../lib/progress";

const stageAt = (lvl: number) => [...TIERS].reverse().find((t) => t.level <= lvl)!.name;

/**
 * Manage what you're working on: edit or remove habits, tasks and your goal.
 * Adding still follows the level limits (habit slots, tasks from Level 10).
 */
export function Plan({ start }: { start: string }) {
  const today = todayISO();
  const { data, actions } = useJourney();
  const { habits, tasks, goals, redeems, habitLog: log } = data;
  const { startSlots } = data.profile;

  const { unlocks } = useMemo(
    // before Day 1 (a journey that starts tomorrow), the rules apply as of Day 1
    () => evaluateJourney({ start, today: today < start ? start : today, habits, habitLog: log, tasks, goals, redeems }),
    [start, today, habits, log, tasks, goals, redeems],
  );

  // ---- goal ----
  const mainGoal = goals.find((g) => g.main && !g.achievedAt);
  const saveGoal = (title: string) => (mainGoal ? actions.renameGoal(mainGoal.id, title) : actions.addGoal(title, { main: true }));

  // ---- habits (same rules as the dashboard) ----
  const current = activeHabits(habits, today);
  const slots = habitSlotsFor(unlocks.habitSlots, habits, start, startSlots);
  const nextSlotAt = levelFor((u) => u.habitSlots > slots);
  const addHabit = (name: string) => {
    if (current.length >= slots) return;
    actions.addHabit(name);
  };
  const updateHabit = (id: string, patch: Pick<Partial<Habit>, "name" | "icon">) => actions.updateHabit(id, patch);
  // removing keeps history; a habit added and removed on the same day disappears entirely
  const removeHabit = actions.removeHabit;

  // ---- tasks: today and upcoming days; past days stay as they were ----
  const [taskDay, setTaskDay] = useState(today);
  const tasksAt = levelFor((u) => u.tasks) ?? 10;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayTasks = tasks.filter((t) => t.date === taskDay);
  const addTask = (title: string) => actions.addTask(title, taskDay);
  const { renameTask, deleteTask } = actions;

  const GoalIcon = mainGoal?.kind ? GOAL_ICON_SET[mainGoal.kind] : Target;

  return (
    <div className="plan-page">
      <header className="page-header">
        <p className="eyebrow">Your plan</p>
        <h1>
          Shape your plan.
          <br />
          <span className="gradient-text">Edit anything, any time.</span>
        </h1>
        <p className="muted">Changes apply from today. Your past days and streak history stay as they were.</p>
      </header>

      {/* ---- future you ---- */}
      <section className="card plan-section">
        <div className="plan-head">
          <h2>Future you</h2>
          <span className="muted small">Who your goals and habits are turning you into</span>
        </div>
        <FutureSection
          future={data.profile.future}
          age={data.profile.birthday ? ageOn(data.profile.birthday, today) : null}
          onSave={actions.setFuture}
        />
      </section>

      {/* ---- goal ---- */}
      <section className="card plan-section">
        <div className="plan-head">
          <h2>Your goal</h2>
          <span className="muted small">The one thing your habits build toward</span>
        </div>
        <ul className="items">
          {mainGoal ? (
            <EditableRow
              icon={<GoalIcon size={18} aria-hidden="true" />}
              title={mainGoal.title}
              onRename={saveGoal}
              removeLabel="Clear goal"
              onRemove={() => actions.deleteGoal(mainGoal.id)}
            />
          ) : (
            <AddField placeholder="Write your goal in one sentence…" onAdd={saveGoal} />
          )}
        </ul>
        {!unlocks.goals && (
          <p className="plan-note">
            <Lock size={14} aria-hidden="true" /> Tracking more goals unlocks at Level {levelFor((u) => u.goals) ?? 20} ·{" "}
            {stageAt(levelFor((u) => u.goals) ?? 20)}.
          </p>
        )}
      </section>

      {/* ---- habits ---- */}
      <section className="card plan-section">
        <div className="plan-head">
          <h2>Habits</h2>
          <span className="plan-count">
            {current.length}/{slots} slots
          </span>
        </div>
        {current.length === 0 && <p className="empty">No habits yet. Start with one you’ll do every day.</p>}
        <ul className="items">
          {current.map((h) => (
            <EditableRow
              key={h.id}
              icon={<HabitIcon name={h.icon} />}
              iconChoices={Object.keys(HABIT_ICON_SET)}
              currentIcon={h.icon}
              onIcon={(icon) => updateHabit(h.id, { icon })}
              title={h.name}
              meta={h.createdAt === today ? "Added today" : `Since ${formatLong(h.createdAt)}`}
              onRename={(name) => updateHabit(h.id, { name })}
              removeLabel="Remove habit"
              removeHint="Its history stays in your stats."
              onRemove={() => removeHabit(h.id)}
            />
          ))}
        </ul>
        {current.length < slots ? (
          <AddField placeholder={`Add a habit… (${current.length}/${slots} slots)`} onAdd={addHabit} />
        ) : (
          <p className="plan-note">
            <Lock size={14} aria-hidden="true" /> {slots === 1 ? "Your habit slot is in use." : `All ${slots} habit slots are in use.`}
            {nextSlotAt ? ` Your next slot unlocks at Level ${nextSlotAt}.` : ""} Remove one to swap it for another.
          </p>
        )}
      </section>

      {/* ---- tasks ---- */}
      <section className="card plan-section">
        <div className="plan-head">
          <h2>Tasks</h2>
          {unlocks.tasks && <span className="muted small">One-off to-dos for a single day</span>}
        </div>
        {unlocks.tasks ? (
          <>
            <div className="plan-days" role="tablist" aria-label="Day">
              {days.map((d, i) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={d === taskDay}
                  className={d === taskDay ? "on" : ""}
                  onClick={() => setTaskDay(d)}
                >
                  <span>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <small>{new Date(d + "T00:00").getDate()}</small>
                </button>
              ))}
            </div>
            {dayTasks.length === 0 && <p className="empty">No tasks for this day.</p>}
            <ul className="items">
              {dayTasks.map((t) => (
                <EditableRow
                  key={t.id}
                  title={t.title}
                  meta={t.done ? "Done" : undefined}
                  done={t.done}
                  onRename={(title) => renameTask(t.id, title)}
                  removeLabel="Delete task"
                  onRemove={() => deleteTask(t.id)}
                />
              ))}
            </ul>
            <AddField placeholder={`Add a task for ${taskDay === today ? "today" : formatLong(taskDay)}…`} onAdd={addTask} />
          </>
        ) : (
          <p className="plan-note">
            <Lock size={14} aria-hidden="true" /> Tasks unlock at Level {tasksAt} · {stageAt(tasksAt)}. First, build the habit of
            showing up: keep a habit going 7 days in a row.
          </p>
        )}
      </section>
    </div>
  );
}

/* ---------- rows ---------- */

type RowProps = {
  title: string;
  meta?: string;
  done?: boolean;
  icon?: React.ReactNode;
  iconChoices?: string[];
  currentIcon?: string;
  onIcon?: (icon: string) => void;
  onRename: (title: string) => void;
  removeLabel: string;
  removeHint?: string;
  onRemove: () => void;
};

/** a list row you can rename, re-icon and remove, with a confirm before removing */
function EditableRow(p: RowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = () => {
    const v = draft?.trim();
    if (v && v.length >= 2) p.onRename(v);
    setDraft(null);
  };

  return (
    <li className={`item plan-row ${p.done ? "done" : ""}`}>
      <div className="plan-row-main">
        {p.icon &&
          (p.iconChoices ? (
            <button
              type="button"
              className={`habit-icon ${picking ? "on" : ""}`}
              onClick={() => setPicking((v) => !v)}
              aria-expanded={picking}
              aria-label="Change icon"
              title="Change icon"
            >
              {p.icon}
            </button>
          ) : (
            <span className="habit-icon" aria-hidden="true">
              {p.icon}
            </span>
          ))}

        {draft !== null ? (
          <form
            className="plan-edit"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <input
              value={draft}
              maxLength={90}
              autoFocus
              aria-label={`Rename ${p.title}`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
            />
            <button type="submit" className="plan-icon-btn ok" aria-label="Save" disabled={(draft.trim().length ?? 0) < 2}>
              <Check size={16} />
            </button>
            <button type="button" className="plan-icon-btn" aria-label="Cancel" onClick={() => setDraft(null)}>
              <X size={16} />
            </button>
          </form>
        ) : (
          <>
            <div className="item-body">
              <span className="item-title">{p.title}</span>
              {p.meta && <span className="item-meta">{p.meta}</span>}
            </div>
            <button type="button" className="plan-icon-btn" onClick={() => setDraft(p.title)} aria-label={`Rename ${p.title}`} title="Rename">
              <PenLine size={16} />
            </button>
            <button
              type="button"
              className="plan-icon-btn danger"
              onClick={() => setConfirming(true)}
              aria-label={`${p.removeLabel}: ${p.title}`}
              title={p.removeLabel}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {picking && p.iconChoices && (
        <div className="plan-icons" role="group" aria-label="Pick an icon">
          {p.iconChoices.map((name) => (
            <button
              key={name}
              type="button"
              className={name === p.currentIcon ? "on" : ""}
              aria-pressed={name === p.currentIcon}
              aria-label={name}
              onClick={() => {
                p.onIcon?.(name);
                setPicking(false);
              }}
            >
              <HabitIcon name={name} size={18} />
            </button>
          ))}
        </div>
      )}

      {confirming && (
        <div className="plan-confirm" role="alert">
          <span>
            {p.removeLabel}? {p.removeHint}
          </span>
          <button
            type="button"
            className="ghost-btn small danger"
            onClick={() => {
              setConfirming(false);
              p.onRemove();
            }}
          >
            Remove
          </button>
          <button type="button" className="ghost-btn small" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </div>
      )}
    </li>
  );
}

function AddField({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="add-row"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (v.length < 2) return;
        onAdd(v);
        setValue("");
      }}
    >
      <Plus size={16} className="add-plus" aria-hidden="true" />
      <input value={value} maxLength={90} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}
