/**
 * Progression rules: every number that shapes the journey lives here.
 *
 * Design intent
 * - Level 100 should mean a real, lasting change in someone's life: about a year of
 *   showing up, five habits that have become part of who you are, one kept for a full
 *   year, and goals actually achieved. Hard, but achievable by anyone who commits.
 * - Habits and goals are what change a life, so they earn far more than tasks.
 *   Tasks earn a little and are capped per day, so spamming tasks can't buy levels.
 * - XP moves you through the levels inside a stage. Crossing into the next stage
 *   needs proof of change (a "gate"), e.g. a habit kept 7 days in a row.
 *   Extra XP isn't lost while a gate is closed: it's banked and counts the moment you pass.
 * - Missing a day happens. A limited "Second Chance" lets you repair one, but only by
 *   doing the habit twice, and only once or twice a month so it never becomes the norm.
 */

export const MAX_LEVEL = 100;

export const XP = {
  /** each habit check-in */
  habitBase: 15,
  /** +1 XP per 3 days of current streak, up to this much (reached at a 30-day streak) */
  habitStreakBonusMax: 10,
  /** each completed task */
  task: 5,
  /** only this many tasks per day earn XP */
  tasksPerDayCap: 5,
  /** every habit (and every task) planned for the day done; needs at least one habit */
  perfectDay: 20,
  /** an achieved goal */
  goal: 750,
  /** at most this many goals per calendar month earn XP */
  goalsRewardedPerMonth: 2,
  /** a goal must exist this long before achieving it counts, so goals can't be created and ticked on the spot */
  goalMinAgeDays: 7,
  /** a missed day repaired with Second Chance earns the base habit XP (no streak bonus) */
  redeemedDay: 15,
} as const;

/**
 * Habit milestones. Each one is judged on a rolling window: "done on `need` of the last `window` days".
 * After the first week the standard is "6 days a week" (~86%): missing a day now and then doesn't stop
 * a habit forming (Lally et al., 2009: about 66 days on average), but skipping often does.
 * Each milestone pays out once per habit, ever.
 */
export const HABIT_MILESTONES = [
  { key: "hatched", label: "Hatched", window: 7, need: 7, xp: 100, describe: "7 days in a row" },
  { key: "forming", label: "Forming", window: 21, need: 18, xp: 300, describe: "18 of 21 days" },
  { key: "established", label: "Established", window: 66, need: 57, xp: 1500, describe: "57 of 66 days" },
  { key: "mastered", label: "Mastered", window: 180, need: 155, xp: 3000, describe: "155 of 180 days" },
  { key: "lifelong", label: "Lifelong", window: 365, need: 313, xp: 6000, describe: "313 of 365 days" },
] as const;

export type MilestoneKey = (typeof HABIT_MILESTONES)[number]["key"];

/** an established habit still counts as "held" if it was done on at least this share of the last 90 days */
export const HELD = { window: 90, share: 0.8 } as const;

export const SECOND_CHANCE = {
  /** the missed day must be 1 or 2 days before the day you make it up */
  maxDaysBack: 2,
} as const;

/**
 * Total XP needed to reach a level: 8 · (L−1)².
 * Early levels come quickly (Level 2 after one check-in, Level 5 within the first week);
 * Level 100 needs 78,408 XP: about 11 months for someone doing 9 of 10 days, ~18 months at 85%.
 * Balance was simulated: see README.md in this folder.
 */
export const CURVE = 8;

export function xpToReach(level: number): number {
  if (level <= 1) return 0;
  return CURVE * (level - 1) ** 2;
}

/** the level your XP alone would reach, before gates */
export function levelFromXp(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / CURVE)) + 1);
}

/** XP for one habit check-in at a given current streak (including today) */
export function habitXp(streak: number): number {
  return XP.habitBase + Math.min(XP.habitStreakBonusMax, Math.floor(Math.max(0, streak - 1) / 3));
}
