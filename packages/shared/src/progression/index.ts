/**
 * Progression module: XP, levels, stages (Egg → Eternal Flight), gates, habit milestones,
 * Second Chance and feature unlocks.
 *
 *   rules.ts   all the numbers (XP values, level curve, habit milestones)
 *   tiers.ts   the 10 stages and the proof of change each one needs
 *   unlocks.ts features that open as you level up
 *   engine.ts  evaluateJourney(): replays history into the full state
 */
export * from "./rules";
export * from "./tiers";
export * from "./unlocks";
export * from "./engine";
