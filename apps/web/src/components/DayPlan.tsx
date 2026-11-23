import { XP, habitXp, type HabitProgress } from "@ascend/shared";
import { useState } from "react";
import type { Goal, Habit, Task } from "../lib/progress";
import { HabitIcon } from "./Icons";

/* ---------- Habits ---------- */

type HabitsProps = {
  /** "today": can check; "past": read-only (Second Chance possible); "future": read-only */
  mode: "today" | "past" | "future";
  habits: Habit[];
  checked: Set<string>;
  redeemed: Set<string>;
  progress: Record<string, HabitProgress | undefined>;
  /** habits done today: Second Chance needs the habit done today (that's the "twice") */
  doneToday: Set<string>;
  secondChancesLeft: number;
  /** the selected day can still be repaired (1–2 days ago, within the journey) */
  canRedeemDay: boolean;
  slots: { used: number; max: number; nextAt?: number };
  onToggle: (id: string) => void;
  onRedeem: (id: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onCycleIcon: (id: string) => void;
};

export function HabitsList(p: HabitsProps) {
  const full = p.slots.used >= p.slots.max;
  return (
    <>
      {p.habits.length === 0 && <p className="empty">No habits yet. Start with one you’ll do every day.</p>}
      <ul className="items">
        {p.habits.map((h) => {
          const done = p.checked.has(h.id);
          const wasRedeemed = p.redeemed.has(h.id);
          const prog = p.progress[h.id];
          const missed = p.mode === "past" && !done && !wasRedeemed;
          return (
            <li key={h.id} className={`item ${done || wasRedeemed ? "done" : ""} ${missed ? "missed" : ""}`}>
              <CheckButton
                done={done || wasRedeemed}
                disabled={p.mode !== "today"}
                onClick={() => p.onToggle(h.id)}
                label={h.name}
                reason={p.mode === "future" ? "You can’t check off future days" : "Habits can only be checked off on the day. Missed it? Use Second Chance."}
              />
              <button className="habit-icon" onClick={() => p.onCycleIcon(h.id)} title="Change icon">
                <HabitIcon name={h.icon} />
              </button>
              <div className="item-body">
                <span className="item-title">
                  {h.name}
                  {prog?.reached.length ? <span className={`stage-tag ${prog.reached[prog.reached.length - 1]}`}>{label(prog.reached[prog.reached.length - 1])}</span> : null}
                </span>
                <span className="item-meta">
                  <span title="Current streak">🔥 {prog?.streak ?? 0} day streak</span>
                  {prog?.next && (
                    <span className="next-ms" title={`${prog.next.label}: done on ${prog.next.need} of the last ${prog.next.window} days`}>
                      <span className="mini-bar">
                        <span style={{ width: `${Math.min(1, prog.next.have / prog.next.need) * 100}%` }} />
                      </span>
                      {prog.next.label} {prog.next.have}/{prog.next.need}
                    </span>
                  )}
                  {wasRedeemed && <span className="redeemed-tag">↺ Second Chance</span>}
                </span>
                {missed && p.canRedeemDay && (
                  <RedeemPrompt
                    left={p.secondChancesLeft}
                    doneToday={p.doneToday.has(h.id)}
                    onRedeem={() => p.onRedeem(h.id)}
                  />
                )}
              </div>
              <span className={`xp-chip ${done ? "earned" : ""}`}>+{habitXp((prog?.streak ?? 0) + (done ? 0 : 1))} XP</span>
              {p.mode === "today" && (
                <button className="remove" onClick={() => p.onRemove(h.id)} aria-label={`Remove ${h.name}`}>
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {p.mode === "today" &&
        (full ? (
          <p className="slot-lock">
            🔒 {p.slots.used}/{p.slots.max} habit slots used.
            {p.slots.nextAt ? ` Your next slot unlocks at Level ${p.slots.nextAt}.` : ""} Focus on making these stick.
          </p>
        ) : (
          <AddRow placeholder={`Add a habit… (${p.slots.used}/${p.slots.max} slots)`} onAdd={p.onAdd} />
        ))}
    </>
  );
}

const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

function RedeemPrompt({ left, doneToday, onRedeem }: { left: number; doneToday: boolean; onRedeem: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (left <= 0) return <p className="redeem-note">No Second Chances left this month.</p>;
  if (!doneToday) return <p className="redeem-note">↺ Second Chance: do this habit today, then once more, to repair this day.</p>;
  return confirming ? (
    <div className="redeem-confirm">
      <span>Did you do it a second time today?</span>
      <button className="primary-btn small" onClick={onRedeem}>
        Yes, repair this day
      </button>
      <button className="ghost-btn small" onClick={() => setConfirming(false)}>
        Not yet
      </button>
    </div>
  ) : (
    <button className="redeem-btn" onClick={() => setConfirming(true)}>
      ↺ Use Second Chance ({left} left this month)
    </button>
  );
}

/* ---------- Tasks ---------- */

type TasksProps = {
  mode: "today" | "past" | "future";
  tasks: Task[];
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
  onDelete: (id: string) => void;
};

export function TasksList(p: TasksProps) {
  return (
    <>
      {p.tasks.length === 0 && <p className="empty">{p.mode === "past" ? "No tasks this day." : "No tasks for this day."}</p>}
      <ul className="items">
        {p.tasks.map((t) => (
          <li key={t.id} className={`item task ${t.done ? "done" : ""}`}>
            <CheckButton
              done={t.done}
              disabled={p.mode !== "today"}
              onClick={() => p.onToggle(t.id)}
              label={t.title}
              reason={p.mode === "future" ? "You can check this off on the day" : "Past days are locked"}
            />
            <div className="item-body">
              <span className="item-title">{t.title}</span>
            </div>
            <span className={`xp-chip ${t.done ? "earned" : ""}`}>+{XP.task} XP</span>
            {p.mode !== "past" && (
              <button className="remove" onClick={() => p.onDelete(t.id)} aria-label={`Delete ${t.title}`}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {p.mode !== "past" && <AddRow placeholder="Add a task…" onAdd={p.onAdd} />}
      <p className="muted small">
        Tasks earn +{XP.task} XP each, up to {XP.tasksPerDayCap} a day. Habits and goals are what level you up.
      </p>
    </>
  );
}

/* ---------- Goals ---------- */

type GoalsProps = {
  today: string;
  goals: Goal[];
  onAdd: (title: string) => void;
  onAchieve: (id: string) => void;
  onUndo: (id: string) => void;
  onDelete: (id: string) => void;
};

export function GoalsList(p: GoalsProps) {
  const open = p.goals.filter((g) => !g.achievedAt);
  const done = p.goals.filter((g) => g.achievedAt).sort((a, b) => (b.achievedAt! > a.achievedAt! ? 1 : -1));
  const age = (g: Goal) => Math.round((Date.parse(p.today) - Date.parse(g.createdAt)) / 86_400_000);

  return (
    <>
      {p.goals.length === 0 && <p className="empty">No goals yet. What would you be proud to achieve in the next few months?</p>}
      <ul className="items">
        {open.map((g) => {
          const young = age(g) < XP.goalMinAgeDays;
          return (
            <li key={g.id} className="item goal">
              <CheckButton done={false} disabled={false} onClick={() => p.onAchieve(g.id)} label={g.title} reason="" />
              <span className="habit-icon" aria-hidden="true">
                🏆
              </span>
              <div className="item-body">
                <span className="item-title">{g.title}</span>
                <span className="item-meta">
                  <span>Set {age(g) === 0 ? "today" : `${age(g)} days ago`}</span>
                  {young && <span title="Goals earn XP once they're at least a week old">Earns XP from day {XP.goalMinAgeDays}</span>}
                </span>
              </div>
              <span className="xp-chip">+{XP.goal} XP</span>
              <button className="remove" onClick={() => p.onDelete(g.id)} aria-label={`Delete ${g.title}`}>
                ×
              </button>
            </li>
          );
        })}
        {done.map((g) => (
          <li key={g.id} className="item goal done">
            <CheckButton
              done
              disabled={g.achievedAt !== p.today}
              onClick={() => p.onUndo(g.id)}
              label={g.title}
              reason="Achieved goals stay achieved"
            />
            <span className="habit-icon" aria-hidden="true">
              🏆
            </span>
            <div className="item-body">
              <span className="item-title">{g.title}</span>
              <span className="item-meta">
                <span>Achieved {new Date(g.achievedAt + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </span>
            </div>
            <span className="xp-chip earned">🏆</span>
          </li>
        ))}
      </ul>
      <AddRow placeholder="Add a goal…" onAdd={p.onAdd} />
    </>
  );
}

/* ---------- shared bits ---------- */

export function LockedFeature({ title, level, stage, children }: { title: string; level: number; stage: string; children: string }) {
  return (
    <div className="locked-feature">
      <span className="lock-icon" aria-hidden="true">
        🔒
      </span>
      <div>
        <p className="locked-title">
          {title} unlock at Level {level} · {stage}
        </p>
        <p className="muted small">{children}</p>
      </div>
    </div>
  );
}

function CheckButton({ done, disabled, onClick, label, reason }: { done: boolean; disabled: boolean; onClick: () => void; label: string; reason: string }) {
  return (
    <button
      className={`check ${done ? "done" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={done}
      aria-label={`${done ? "Unmark" : "Mark"} ${label}`}
      title={disabled ? reason : undefined}
    >
      {done && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="add-row"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v) return;
        onAdd(v);
        setValue("");
      }}
    >
      <span className="add-plus" aria-hidden="true">
        +
      </span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </form>
  );
}
