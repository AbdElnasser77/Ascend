
export type Habit = {
  id: string;
  name: string;
  icon: string;
  /** first day the habit counts toward progress */
  createdAt: string;
  /** removed habits keep their history; they stop counting from this day */
  archivedAt?: string;
};

export type Task = {
  id: string;
  title: string;
  date: string;
  done: boolean;
};

export type Goal = {
  id: string;
  title: string;
  createdAt: string;
  achievedAt?: string;
};

/** Second Chance: `day` was missed and made up on `on` by doing the habit twice */
export type Redeem = { habitId: string; day: string; on: string };

/** date -> ids of habits checked off that day */
export type HabitLog = Record<string, string[]>;

export type DayStats = {
  habitsDone: number;
  tasksDone: number;
  done: number;
  total: number;
  /** 0..1 share of the day's items completed */
  score: number;
};

export const HABIT_ICONS = ["💻", "📚", "🏃", "💧", "🧘", "✍️", "🎯", "🌱", "💪", "🎨"];

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function activeHabits(habits: Habit[], date: string): Habit[] {
  return habits.filter((h) => h.createdAt <= date && (!h.archivedAt || date < h.archivedAt));
}

export function dayStats(date: string, habits: Habit[], tasks: Task[], log: HabitLog): DayStats {
  const hs = activeHabits(habits, date);
  const checked = new Set(log[date] ?? []);
  const ts = tasks.filter((t) => t.date === date);
  const total = hs.length + ts.length;
  const habitsDone = hs.filter((h) => checked.has(h.id)).length;
  const tasksDone = ts.filter((t) => t.done).length;
  const done = habitsDone + tasksDone;
  return { habitsDone, tasksDone, done, total, score: total ? done / total : 0 };
}
