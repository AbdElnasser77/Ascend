import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateJourney, type JourneyInput } from "./engine";
import { XP, habitXp, levelFromXp, xpToReach } from "./rules";

const plus = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const START = "2026-01-01";

/** a journey where habit `h` is done on the given day offsets */
function journey(days: number, doneOn: (i: number) => boolean, extra: Partial<JourneyInput> = {}): JourneyInput {
  const habitLog: Record<string, string[]> = {};
  for (let i = 0; i < days; i++) if (doneOn(i)) habitLog[plus(START, i)] = ["h"];
  return {
    start: START,
    today: plus(START, days - 1),
    habits: [{ id: "h", createdAt: START }],
    habitLog,
    tasks: [],
    goals: [],
    redeems: [],
    ...extra,
  };
}

test("level curve: one check-in reaches Level 2, Level 100 needs 78,408 XP", () => {
  assert.equal(levelFromXp(habitXp(1)), 2);
  assert.equal(xpToReach(100), 78_408);
  assert.equal(levelFromXp(78_407), 99);
  assert.equal(levelFromXp(78_408), 100);
});

test("a habit kept 7 days in a row hatches once, with its bonus", () => {
  const s = evaluateJourney(journey(14, () => true));
  const hatched = s.days.flatMap((d) => d.events).filter((e) => e.type === "milestone" && e.milestone === "hatched");
  assert.equal(hatched.length, 1);
  assert.deepEqual(s.habits.h.reached, ["hatched"]);
  assert.equal(s.habits.h.streak, 14);
});

test("today not done yet doesn't break the streak", () => {
  const s = evaluateJourney(journey(10, (i) => i < 9));
  assert.equal(s.habits.h.streak, 9);
});

test("gate: without a hatched habit you stay below Level 10, and the extra XP is banked", () => {
  // every other day: plenty of XP over 200 days, but never 7 in a row
  const s = evaluateJourney(journey(200, (i) => i % 2 === 0));
  assert.ok(s.xpLevel >= 10, `xpLevel ${s.xpLevel}`);
  assert.equal(s.level, 9);
  assert.equal(s.tier.name, "Egg");
  assert.equal(s.blocked, true);
  assert.equal(s.gate?.requirements[0].met, false);
});

test("habit slots and tasks unlock with level", () => {
  assert.equal(evaluateJourney(journey(1, () => false)).unlocks.habitSlots, 1);
  const s = evaluateJourney(journey(30, () => true));
  assert.ok(s.level >= 10);
  assert.equal(s.unlocks.tasks, true);
  assert.equal(s.unlocks.secondChances, 1);
});

test("Second Chance repairs a missed day only when the habit is done the day you redeem", () => {
  const missed = 20;
  const base = journey(22, (i) => i !== missed);
  const day = plus(START, missed);
  const on = plus(START, missed + 1);

  const ok = evaluateJourney({ ...base, redeems: [{ habitId: "h", day, on }] });
  assert.deepEqual(ok.redeemed[day], ["h"]);
  assert.equal(ok.habits.h.streak, 22);
  assert.equal(ok.secondChancesLeft, 0);

  // not done on the redeem day → rejected
  const log = { ...base.habitLog };
  delete log[on];
  const rejected = evaluateJourney({ ...base, habitLog: log, redeems: [{ habitId: "h", day, on }] });
  assert.equal(rejected.redeemed[day], undefined);
});

test("Second Chance is limited per month and to 2 days back", () => {
  // misses on days 15 and 18 in January; only 1 chance a month at this level
  const base = journey(25, (i) => i !== 15 && i !== 18);
  const s = evaluateJourney({
    ...base,
    redeems: [
      { habitId: "h", day: plus(START, 15), on: plus(START, 16) },
      { habitId: "h", day: plus(START, 18), on: plus(START, 19) },
    ],
  });
  assert.equal(Object.keys(s.redeemed).length, 1);

  const tooLate = evaluateJourney({ ...base, redeems: [{ habitId: "h", day: plus(START, 15), on: plus(START, 18 + 1) }] });
  assert.equal(Object.keys(tooLate.redeemed).length, 0);
});

test("goals: must be a week old to count, and only a few earn XP each month", () => {
  const goals = [
    { id: "young", createdAt: plus(START, 40), achievedAt: plus(START, 42) },
    { id: "a", createdAt: START, achievedAt: plus(START, 40) },
    { id: "b", createdAt: START, achievedAt: plus(START, 41) },
    { id: "c", createdAt: START, achievedAt: plus(START, 42) },
  ];
  const s = evaluateJourney(journey(45, () => true, { goals }));
  const goalEvents = s.days.flatMap((d) => d.events).filter((e) => e.type === "goal");
  assert.equal(goalEvents.length, 3, "the young goal doesn't count");
  assert.deepEqual(
    goalEvents.map((e) => (e.type === "goal" ? e.xp : 0)),
    [XP.goal, XP.goal, 0],
    "February pays out for 2 goals",
  );
});

test("tasks are capped per day", () => {
  const tasks = Array.from({ length: 10 }, () => ({ date: START, done: true }));
  const s = evaluateJourney({ ...journey(1, () => false), tasks });
  assert.equal(s.days[0].xp, XP.tasksPerDayCap * XP.task);
});

test("levels never go down", () => {
  const s = evaluateJourney(journey(60, (i) => i < 20));
  const levels = s.days.map((d) => d.level);
  assert.ok(levels.every((l, i) => i === 0 || l >= levels[i - 1]));
});
