import { HABIT_MILESTONES, HELD, SECOND_CHANCE, XP, habitXp, levelFromXp, xpToReach, MAX_LEVEL, type MilestoneKey } from "./rules";
import { TIERS, describeRequirement, nextTier as nextTierAfter, tierFor, type Requirement, type Tier } from "./tiers";
import { unlocksAt, type Unlocks } from "./unlocks";

/* ---------- inputs ---------- */

export type HabitInput = { id: string; createdAt: string; archivedAt?: string };
export type TaskInput = { date: string; done: boolean };
export type GoalInput = { id: string; createdAt: string; achievedAt?: string };
/** "I missed `day`, and made up for it on `on` by doing the habit twice" */
export type RedeemInput = { habitId: string; day: string; on: string };

export type JourneyInput = {
  /** Day 1 (YYYY-MM-DD) */
  start: string;
  today: string;
  habits: HabitInput[];
  /** date → ids of habits done that day */
  habitLog: Record<string, string[]>;
  tasks: TaskInput[];
  goals: GoalInput[];
  redeems: RedeemInput[];
};

/* ---------- outputs ---------- */

export type JourneyEvent =
  | { type: "level"; level: number }
  | { type: "tier"; tier: Tier }
  | { type: "milestone"; habitId: string; milestone: MilestoneKey; label: string; xp: number }
  | { type: "goal"; goalId: string; xp: number }
  | { type: "redeem"; habitId: string; day: string };

export type DayRecord = {
  date: string;
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  done: number;
  total: number;
  /** 0..1 share of the day's habits and tasks completed */
  score: number;
  /** all XP earned that day, bonuses included */
  xp: number;
  /** level at the end of the day */
  level: number;
  events: JourneyEvent[];
};

export type HabitProgress = {
  streak: number;
  best: number;
  total: number;
  reached: MilestoneKey[];
  /** the next milestone and how close you are, judged on its rolling window */
  next?: { key: MilestoneKey; label: string; describe: string; have: number; need: number; window: number };
  /** share of the last 90 days done (or since the habit started, if newer) */
  adherence: number;
};

export type RequirementStatus = { requirement: Requirement; label: string; have: number; need: number; met: boolean };

export type JourneyState = {
  xp: number;
  level: number;
  /** the level XP alone would give; above `level` when a gate is holding you back */
  xpLevel: number;
  tier: Tier;
  nextTier?: Tier;
  intoLevel: number;
  levelSpan: number;
  /** 0..1 toward the next level */
  pct: number;
  /** the next stage's gate, with progress on each requirement */
  gate?: { tier: Tier; requirements: RequirementStatus[]; met: boolean };
  /** XP is ready for the next stage but the gate isn't met yet */
  blocked: boolean;
  unlocks: Unlocks;
  secondChancesLeft: number;
  habits: Record<string, HabitProgress>;
  /** valid Second Chance repairs: date → habit ids */
  redeemed: Record<string, string[]>;
  days: DayRecord[];
};

/* ---------- date helpers (UTC, YYYY-MM-DD) ---------- */

const DAY = 86_400_000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const between = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);
const plus = (iso: string, n: number) => new Date(toTime(iso) + n * DAY).toISOString().slice(0, 10);
const month = (iso: string) => iso.slice(0, 7);

/* ---------- engine ---------- */

type HabitRun = {
  input: HabitInput;
  from: number; // first day index it counts
  until: number; // first day index it stops counting (exclusive)
  done: boolean[];
  reached: Set<MilestoneKey>;
};

/**
 * Replays the whole journey from Day 1 to today and returns the full progression state.
 * Pure and deterministic: the API should run this same function to get authoritative numbers.
 * Levels never go down: momentum can fade, but what you reached stays reached.
 */
export function evaluateJourney(input: JourneyInput): JourneyState {
  const n = Math.max(1, between(input.start, input.today) + 1);
  const dates = Array.from({ length: n }, (_, i) => plus(input.start, i));

  const runs: HabitRun[] = input.habits.map((h) => ({
    input: h,
    from: Math.max(0, between(input.start, h.createdAt)),
    until: h.archivedAt ? Math.min(n, between(input.start, h.archivedAt)) : n,
    done: new Array(n).fill(false),
    reached: new Set(),
  }));
  const runById = new Map(runs.map((r) => [r.input.id, r]));

  const tasksByDate = new Map<string, TaskInput[]>();
  for (const t of input.tasks) tasksByDate.set(t.date, [...(tasksByDate.get(t.date) ?? []), t]);

  const redeemsByDay = new Map<string, RedeemInput[]>();
  for (const r of input.redeems) redeemsByDay.set(r.on, [...(redeemsByDay.get(r.on) ?? []), r]);

  const goalsByDay = new Map<string, GoalInput[]>();
  for (const g of input.goals) if (g.achievedAt) goalsByDay.set(g.achievedAt, [...(goalsByDay.get(g.achievedAt) ?? []), g]);

  let xp = 0;
  let level = 1;
  let passed = 0; // index into TIERS of the last stage whose gate is passed
  let goalsCounted = 0;
  const goalXpByMonth = new Map<string, number>();
  const redeemsByMonth = new Map<string, number>();
  const redeemed: Record<string, string[]> = {};
  const days: DayRecord[] = [];

  const streakAt = (r: HabitRun, i: number) => {
    let s = 0;
    for (let k = i; k >= r.from && r.done[k]; k--) s++;
    return s;
  };
  const countIn = (r: HabitRun, i: number, window: number) => {
    let c = 0;
    for (let k = Math.max(r.from, i - window + 1); k <= i; k++) if (r.done[k]) c++;
    return c;
  };
  const active = (r: HabitRun, i: number) => i >= r.from && i < r.until;

  const statsAt = (i: number) => ({
    milestone: (key: MilestoneKey) => runs.filter((r) => r.reached.has(key)).length,
    goals: goalsCounted,
    days: i + 1,
    held: runs.filter((r) => {
      if (!r.reached.has("established") || !active(r, i)) return false;
      const len = Math.min(HELD.window, i - r.from + 1);
      return countIn(r, i, HELD.window) / len >= HELD.share;
    }).length,
  });

  const have = (req: Requirement, s: ReturnType<typeof statsAt>) =>
    req.kind === "milestone" ? s.milestone(req.milestone) : req.kind === "goals" ? s.goals : req.kind === "days" ? s.days : s.held;

  for (let i = 0; i < n; i++) {
    const d = dates[i];
    const events: JourneyEvent[] = [];
    let dayXp = 0;
    const doneToday = new Set(input.habitLog[d] ?? []);

    // 1. habits done today
    let habitsDone = 0;
    let habitsTotal = 0;
    for (const r of runs) {
      if (!active(r, i)) continue;
      habitsTotal++;
      if (doneToday.has(r.input.id)) r.done[i] = true;
    }

    // 2. Second Chance: repair a missed day 1–2 days back, only if the habit is done today ("done twice")
    const allowance = unlocksAt(level).secondChances;
    for (const rd of redeemsByDay.get(d) ?? []) {
      const r = runById.get(rd.habitId);
      const back = between(rd.day, d);
      const idx = between(input.start, rd.day);
      const used = redeemsByMonth.get(month(d)) ?? 0;
      if (!r || back < 1 || back > SECOND_CHANCE.maxDaysBack || idx < 0) continue;
      if (!active(r, idx) || r.done[idx] || !r.done[i] || used >= allowance) continue;
      r.done[idx] = true;
      redeemsByMonth.set(month(d), used + 1);
      (redeemed[rd.day] ??= []).push(r.input.id);
      dayXp += XP.redeemedDay;
      events.push({ type: "redeem", habitId: r.input.id, day: rd.day });
    }

    // 3. habit XP and milestones
    for (const r of runs) {
      if (!active(r, i)) continue;
      if (r.done[i]) {
        habitsDone++;
        dayXp += habitXp(streakAt(r, i));
      }
      for (const m of HABIT_MILESTONES) {
        if (r.reached.has(m.key)) continue;
        if (countIn(r, i, m.window) >= m.need) {
          r.reached.add(m.key);
          dayXp += m.xp;
          events.push({ type: "milestone", habitId: r.input.id, milestone: m.key, label: m.label, xp: m.xp });
        }
      }
    }

    // 4. tasks: a little XP each, capped per day
    const ts = tasksByDate.get(d) ?? [];
    const tasksDone = ts.filter((t) => t.done).length;
    dayXp += Math.min(tasksDone, XP.tasksPerDayCap) * XP.task;

    // 5. perfect day
    if (habitsTotal > 0 && habitsDone === habitsTotal && tasksDone === ts.length) dayXp += XP.perfectDay;

    // 6. goals: must be at least a week old; XP for the first few each month
    for (const g of goalsByDay.get(d) ?? []) {
      if (between(g.createdAt, d) < XP.goalMinAgeDays) continue;
      goalsCounted++;
      const paid = goalXpByMonth.get(month(d)) ?? 0;
      const gx = paid < XP.goalsRewardedPerMonth ? XP.goal : 0;
      goalXpByMonth.set(month(d), paid + 1);
      dayXp += gx;
      events.push({ type: "goal", goalId: g.id, xp: gx });
    }

    xp += dayXp;

    // 7. gates, then level (capped below any stage whose gate isn't passed yet; never goes down)
    const s = statsAt(i);
    while (passed + 1 < TIERS.length && TIERS[passed + 1].gate.every((req) => have(req, s) >= req.count)) passed++;
    const cap = passed + 1 < TIERS.length ? TIERS[passed + 1].level - 1 : MAX_LEVEL;
    const newLevel = Math.max(level, Math.min(levelFromXp(xp), cap));
    if (newLevel > level) {
      const before = tierFor(level);
      events.push({ type: "level", level: newLevel });
      const after = tierFor(newLevel);
      if (after.level !== before.level) events.push({ type: "tier", tier: after });
      level = newLevel;
    }

    const total = habitsTotal + ts.length;
    const done = habitsDone + tasksDone;
    days.push({
      date: d,
      habitsDone,
      habitsTotal,
      tasksDone,
      tasksTotal: ts.length,
      done,
      total,
      score: total ? done / total : 0,
      xp: dayXp,
      level,
      events,
    });
  }

  // ---- summary ----
  const last = n - 1;
  const xpLevel = levelFromXp(xp);
  const tier = tierFor(level);
  const next = nextTierAfter(level);
  const floor = xpToReach(level);
  const ceil = level >= MAX_LEVEL ? floor : xpToReach(level + 1);
  const levelSpan = Math.max(1, ceil - floor);
  const intoLevel = Math.max(0, xp - floor);

  const s = statsAt(last);
  const gate = next
    ? (() => {
        const requirements = next.gate.map((req) => {
          const h = have(req, s);
          return { requirement: req, label: describeRequirement(req), have: Math.min(h, req.count), need: req.count, met: h >= req.count };
        });
        return { tier: next, requirements, met: requirements.every((r) => r.met) };
      })()
    : undefined;

  const habits: Record<string, HabitProgress> = {};
  for (const r of runs) {
    const end = Math.min(last, r.until - 1);
    let best = 0;
    let run = 0;
    let total = 0;
    for (let k = r.from; k <= end; k++) {
      run = r.done[k] ? run + 1 : 0;
      best = Math.max(best, run);
      if (r.done[k]) total++;
    }
    // today still open: a streak that ran through yesterday is still alive
    const streak = end >= r.from ? (r.done[end] ? streakAt(r, end) : end - 1 >= r.from ? streakAt(r, end - 1) : 0) : 0;
    const m = HABIT_MILESTONES.find((x) => !r.reached.has(x.key));
    const len = Math.max(1, Math.min(HELD.window, end - r.from + 1));
    habits[r.input.id] = {
      streak,
      best,
      total,
      reached: HABIT_MILESTONES.filter((x) => r.reached.has(x.key)).map((x) => x.key),
      next: m && end >= r.from ? { key: m.key, label: m.label, describe: m.describe, have: countIn(r, end, m.window), need: m.need, window: m.window } : undefined,
      adherence: end >= r.from ? countIn(r, end, HELD.window) / len : 0,
    };
  }

  const unlocks = unlocksAt(level);
  return {
    xp,
    level,
    xpLevel,
    tier,
    nextTier: next,
    intoLevel,
    levelSpan,
    pct: level >= MAX_LEVEL ? 1 : Math.min(1, intoLevel / levelSpan),
    gate,
    blocked: Boolean(next && gate && !gate.met && xpLevel >= next.level),
    unlocks,
    secondChancesLeft: Math.max(0, unlocks.secondChances - (redeemsByMonth.get(month(input.today)) ?? 0)),
    habits,
    redeemed,
    days,
  };
}
