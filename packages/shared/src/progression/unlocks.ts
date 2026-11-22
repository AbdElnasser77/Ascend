/**
 * Features open up as you grow, so a new user isn't overwhelmed:
 * the first stage is about one habit (then two) and nothing else.
 */

export type Unlocks = {
  habitSlots: number;
  tasks: boolean;
  goals: boolean;
  /** Second Chance repairs available per calendar month */
  secondChances: number;
  statsRanges: number[];
};

export type UnlockStep = { level: number; label: string; apply: (u: Unlocks) => void };

export const UNLOCK_STEPS: UnlockStep[] = [
  { level: 1, label: "Your first habit", apply: (u) => void (u.habitSlots = 1) },
  { level: 3, label: "A second habit slot", apply: (u) => void (u.habitSlots = 2) },
  { level: 10, label: "Daily tasks", apply: (u) => void (u.tasks = true) },
  { level: 10, label: "Second Chance: repair 1 missed day a month", apply: (u) => void (u.secondChances = 1) },
  { level: 10, label: "A third habit slot", apply: (u) => void (u.habitSlots = 3) },
  { level: 20, label: "Goals", apply: (u) => void (u.goals = true) },
  { level: 20, label: "30-day stats", apply: (u) => void u.statsRanges.push(30) },
  { level: 30, label: "A fourth habit slot", apply: (u) => void (u.habitSlots = 4) },
  { level: 30, label: "Second Chance: 2 a month", apply: (u) => void (u.secondChances = 2) },
  { level: 30, label: "90-day stats", apply: (u) => void u.statsRanges.push(90) },
  { level: 40, label: "A fifth habit slot", apply: (u) => void (u.habitSlots = 5) },
  { level: 50, label: "A sixth habit slot", apply: (u) => void (u.habitSlots = 6) },
  { level: 60, label: "A seventh habit slot", apply: (u) => void (u.habitSlots = 7) },
  { level: 70, label: "An eighth habit slot", apply: (u) => void (u.habitSlots = 8) },
];

export function unlocksAt(level: number): Unlocks {
  const u: Unlocks = { habitSlots: 0, tasks: false, goals: false, secondChances: 0, statsRanges: [7] };
  for (const s of UNLOCK_STEPS) if (level >= s.level) s.apply(u);
  return u;
}

/** the unlock steps that open between two levels (exclusive of `from`, inclusive of `to`) */
export function unlocksBetween(from: number, to: number): UnlockStep[] {
  return UNLOCK_STEPS.filter((s) => s.level > from && s.level <= to);
}

/** the first level at which a feature opens */
export function levelFor(pred: (u: Unlocks) => boolean): number | undefined {
  return UNLOCK_STEPS.find((s) => pred(unlocksAt(s.level)))?.level;
}
