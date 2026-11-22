# Progression module

Ascend's leveling system: XP, levels 1–100, the 10 stages from Egg to Eternal Flight, the gates between them, habit milestones, Second Chance, and feature unlocks.

The module is pure TypeScript with no I/O. The web app runs it for instant feedback, and the API should run the same `evaluateJourney()` to compute the official numbers.

| File | What it holds |
|---|---|
| `rules.ts` | Every number: XP values, the level curve, habit milestones, Second Chance limits |
| `tiers.ts` | The 10 stages, what each one means, and the proof of change needed to enter it |
| `unlocks.ts` | Features that open as you level up |
| `engine.ts` | `evaluateJourney(input)`: replays the history day by day and returns the full state |
| `engine.test.ts` | Rule tests (`npm test -w @ascend/shared`) |

## Principles

1. **Level 100 means a changed life.** It takes a full year on the journey, five established habits still being kept, one habit kept for a year (313 of 365 days), and six goals achieved. It's hard, but anyone who commits can get there.
2. **Habits and goals change lives; tasks support them.**
   - Habit check-in: 15 XP, plus up to 10 more for a streak.
   - Habit milestones: up to 6,000 XP.
   - Goal: 750 XP.
   - Task: 5 XP, and only 5 tasks a day count.
3. **XP alone can't buy a stage.** XP moves you through the levels inside a stage. Entering the next stage needs a gate, which is real proof of change. While a gate is closed, extra XP is banked and counts the moment it opens.
4. **Habit milestones use a rolling window.** The first week is strict: 7 days in a row. After that the standard is about 6 days a week:

   | Milestone | Requirement | Bonus |
   |---|---|---|
   | Forming | 18 of 21 days | +300 XP |
   | Established | 57 of 66 days | +1,500 XP |
   | Mastered | 155 of 180 days | +3,000 XP |
   | Lifelong | 313 of 365 days | +6,000 XP |

5. **Second Chance repairs a missed habit day by doing the habit twice today.** It only works for days up to 2 days back. You get 1 a month from Level 10 and 2 a month from Level 30, so it can't become the norm.
6. **History is the source of truth.** XP is never stored; it's recomputed from check-ins every time. That means the rules can be rebalanced and everyone's level recomputes fairly.
7. **Levels never go down.** Momentum, the last 7 days, only dims or brightens the stage art.
8. **Anti-gaming rules:**
   - Habits can only be checked off on the day itself.
   - Goals must exist for 7 days before achieving them counts.
   - Only 2 goals a month earn XP.
   - Habit slots are limited by level.
   - The API must enforce the "on the day" rule on the server.

## Stages

| Level | Stage | Gate (in addition to reaching the level) | Opens |
|---|---|---|---|
| 1 | Egg | (none) | 1 habit slot (2 at Level 3) |
| 10 | Caterpillar | A habit kept 7 days in a row | Tasks, Second Chance (1 a month), 3rd habit slot |
| 20 | Cocoon | A habit kept 18 of 21 days | Goals, 30-day stats |
| 30 | Transformation | A habit established | 4th habit slot, 2 Second Chances a month, 90-day stats |
| 40 | Emergence | 2 habits established, 1 goal achieved | 5th habit slot |
| 50 | Awakening | 3 habits established, 2 goals, 120 days | 6th habit slot |
| 60 | Ascension | A habit mastered, 3 established | 7th habit slot |
| 70 | Radiance | 4 habits established, 4 goals, 210 days | 8th habit slot |
| 80 | Transcendence | 5 habits established, 2 mastered, 5 goals | (none) |
| 100 | Eternal Flight | 365 days, a lifelong habit, 5 established habits still kept (80% of the last 90 days), 6 goals | (none) |

## Balance (simulated)

Assumptions for each simulated user:
- Up to 5 habits, adding a new one whenever a slot opens.
- 3 tasks a day from Level 10.
- One goal at a time, achieved about 40 days after it's set.
- Second Chance used whenever it's available.

| User | Days a habit is done | Day each stage is reached | After 450 days |
|---|---|---|---|
| Committed | 93% | Caterpillar 10, Cocoon 30, Transformation 61, Emergence 80, Awakening 122, Ascension 168, Radiance 210, Transcendence 246, **Eternal Flight 365** | Level 100 |
| Solid | 85% | Caterpillar 15, Cocoon 34, Transformation 67, Emergence 104, Awakening 155, Ascension 178, Radiance 263, Transcendence 329 | Level 99, one held habit short of Level 100 (about 15 months in total) |
| Average | 72% | Caterpillar 29, Cocoon 59 | Level 29: XP for Level 59, but no habit established |
| Casual | 50% | Caterpillar 67 | Level 19 |

When you change a number in `rules.ts`, rerun a simulation like this and update the table.
