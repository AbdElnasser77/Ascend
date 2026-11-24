import { evaluateJourney, habitSlotsFor, type JourneyState } from "@ascend/shared";
import { pool } from "../db/pool.js";
import { HttpError } from "../http.js";

// Shapes the web app works with (apps/web/src/lib/progress.ts). Absent optional fields are omitted, never null.
export type Habit = { id: string; name: string; icon: string; createdAt: string; archivedAt?: string };
export type Task = { id: string; title: string; date: string; done: boolean };
export type Goal = { id: string; title: string; createdAt: string; achievedAt?: string; kind?: string; main?: boolean };
export type Redeem = { habitId: string; day: string; on: string };
/** who the user wants to become, `years` from when they wrote it */
export type Future = { statement: string | null; years: number | null; traits: string[] };
export type Profile = { birthday: string | null; journeyStart: string | null; startSlots: number | null; future: Future };

export type Journey = {
  profile: Profile;
  habits: Habit[];
  habitLog: Record<string, string[]>;
  tasks: Task[];
  goals: Goal[];
  redeems: Redeem[];
};

export async function loadJourney(userId: string): Promise<Journey> {
  const [profile, habits, checks, tasks, goals, redeems] = await Promise.all([
    pool.query(`SELECT birthday, journey_start, start_slots, future_self, future_years, future_traits FROM users WHERE id = $1`, [userId]),
    pool.query(`SELECT id, name, icon, created_on, archived_on FROM habits WHERE user_id = $1 ORDER BY created_at, id`, [userId]),
    pool.query(`SELECT habit_id, day FROM habit_checks WHERE user_id = $1 ORDER BY day`, [userId]),
    pool.query(`SELECT id, title, day, done FROM tasks WHERE user_id = $1 ORDER BY day, created_at, id`, [userId]),
    pool.query(`SELECT id, title, kind, main, created_on, achieved_on FROM goals WHERE user_id = $1 ORDER BY created_at, id`, [userId]),
    pool.query(`SELECT habit_id, day, redeemed_on FROM habit_redeems WHERE user_id = $1 ORDER BY redeemed_on, day`, [userId]),
  ]);
  const p = profile.rows[0];
  if (!p) throw new HttpError(401, "Account not found");

  const habitLog: Record<string, string[]> = {};
  for (const c of checks.rows) (habitLog[c.day] ??= []).push(c.habit_id);

  return {
    profile: {
      birthday: p.birthday,
      journeyStart: p.journey_start,
      startSlots: p.start_slots,
      future: { statement: p.future_self, years: p.future_years, traits: p.future_traits },
    },
    habits: habits.rows.map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      createdAt: h.created_on,
      ...(h.archived_on && { archivedAt: h.archived_on }),
    })),
    habitLog,
    tasks: tasks.rows.map((t) => ({ id: t.id, title: t.title, date: t.day, done: t.done })),
    goals: goals.rows.map((g) => ({
      id: g.id,
      title: g.title,
      createdAt: g.created_on,
      ...(g.achieved_on && { achievedAt: g.achieved_on }),
      ...(g.kind && { kind: g.kind }),
      ...(g.main && { main: true }),
    })),
    redeems: redeems.rows.map((r) => ({ habitId: r.habit_id, day: r.day, on: r.redeemed_on })),
  };
}

export type Evaluated = { journey: Journey; start: string; today: string; state: JourneyState; habitSlots: number };

/**
 * The user's journey replayed through the same progression engine the web uses,
 * so level-gated rules (habit slots, tasks, goals, Second Chance) are enforced here too.
 */
export async function evaluate(userId: string, today: string): Promise<Evaluated> {
  const journey = await loadJourney(userId);
  const start = journey.profile.journeyStart;
  if (!start) throw new HttpError(409, "Finish setting up your journey first");
  // a timezone change can put "today" a day before Day 1; never evaluate before the start
  const day = today < start ? start : today;
  const state = evaluateJourney({ start, today: day, ...journey });
  const habitSlots = habitSlotsFor(state.unlocks.habitSlots, journey.habits, start, journey.profile.startSlots);
  return { journey, start, today: day, state, habitSlots };
}

export const isActiveOn = (h: Habit, day: string) => h.createdAt <= day && (!h.archivedAt || day < h.archivedAt);
