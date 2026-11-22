import type { MilestoneKey } from "./rules";

/** What a gate checks. Each is a fact about your history, never just XP. */
export type Requirement =
  | { kind: "milestone"; milestone: MilestoneKey; count: number }
  | { kind: "goals"; count: number }
  | { kind: "days"; count: number }
  | { kind: "held"; count: number };

export type Tier = {
  level: number;
  /** the form you take: the cocoon → butterfly story */
  name: string;
  /** one line on what this stage means in your life */
  meaning: string;
  /** what you must have done to enter this stage (empty for the first) */
  gate: Requirement[];
  /** /levels/<image>.png */
  image: string;
};

export const TIERS: Tier[] = [
  {
    level: 1,
    name: "Egg",
    meaning: "You decided to change. Start with one habit and show up for it.",
    gate: [],
    image: "stage-1",
  },
  {
    level: 10,
    name: "Caterpillar",
    meaning: "You’re feeding the habit of showing up, day after day.",
    gate: [{ kind: "milestone", milestone: "hatched", count: 1 }],
    image: "stage-10",
  },
  {
    level: 20,
    name: "Cocoon",
    meaning: "You go inward and do the work, even when no one sees it.",
    gate: [{ kind: "milestone", milestone: "forming", count: 1 }],
    image: "stage-20",
  },
  {
    level: 30,
    name: "Transformation",
    meaning: "A habit is now part of you. Something has changed inside.",
    gate: [{ kind: "milestone", milestone: "established", count: 1 }],
    image: "stage-30",
  },
  {
    level: 40,
    name: "Emergence",
    meaning: "The old shell can’t hold you. Your first goal is real.",
    gate: [
      { kind: "milestone", milestone: "established", count: 2 },
      { kind: "goals", count: 1 },
    ],
    image: "stage-40",
  },
  {
    level: 50,
    name: "Awakening",
    meaning: "Halfway. You see yourself differently now.",
    gate: [
      { kind: "milestone", milestone: "established", count: 3 },
      { kind: "goals", count: 2 },
      { kind: "days", count: 120 },
    ],
    image: "stage-50",
  },
  {
    level: 60,
    name: "Ascension",
    meaning: "Your habits run on their own. Discipline feels natural.",
    gate: [
      { kind: "milestone", milestone: "mastered", count: 1 },
      { kind: "milestone", milestone: "established", count: 3 },
    ],
    image: "stage-60",
  },
  {
    level: 70,
    name: "Radiance",
    meaning: "People notice the change in you, and it inspires them.",
    gate: [
      { kind: "milestone", milestone: "established", count: 4 },
      { kind: "goals", count: 4 },
      { kind: "days", count: 210 },
    ],
    image: "stage-70",
  },
  {
    level: 80,
    name: "Transcendence",
    meaning: "Discipline is no longer what you do. It’s who you are.",
    gate: [
      { kind: "milestone", milestone: "established", count: 5 },
      { kind: "milestone", milestone: "mastered", count: 2 },
      { kind: "goals", count: 5 },
    ],
    image: "stage-80",
  },
  {
    level: 100,
    name: "Eternal Flight",
    meaning: "A changed life. A full year, five habits held, a habit for life, goals achieved. You became who you set out to be.",
    gate: [
      { kind: "days", count: 365 },
      { kind: "milestone", milestone: "lifelong", count: 1 },
      { kind: "held", count: 5 },
      { kind: "goals", count: 6 },
    ],
    image: "stage-100",
  },
];

export function tierFor(level: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (level >= tier.level) t = tier;
  return t;
}

export function nextTier(level: number): Tier | undefined {
  return TIERS.find((t) => t.level > level);
}

const MILESTONE_TEXT: Record<MilestoneKey, [string, string]> = {
  hatched: ["Keep a habit 7 days in a row", "habits hatched"],
  forming: ["Keep a habit 18 of 21 days", "habits forming"],
  established: ["Establish a habit: 57 of 66 days", "habits established"],
  mastered: ["Master a habit: 155 of 180 days", "habits mastered"],
  lifelong: ["Keep one habit 313 of 365 days", "lifelong habits"],
};

/** human wording for a requirement */
export function describeRequirement(r: Requirement): string {
  switch (r.kind) {
    case "milestone":
      return r.count === 1 ? MILESTONE_TEXT[r.milestone][0] : `${r.count} ${MILESTONE_TEXT[r.milestone][1]}`;
    case "goals":
      return r.count === 1 ? "Achieve a goal" : `Achieve ${r.count} goals`;
    case "days":
      return `${r.count} days on your journey`;
    case "held":
      return `${r.count} established habits still kept (80% of the last 90 days)`;
  }
}
