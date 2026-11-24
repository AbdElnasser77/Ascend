import {
  ArrowRight,
  Cake,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  Lightbulb,
  Map as MapIcon,
  PenLine,
  Play,
  Repeat,
  Rocket,
  Sparkles,
  Sprout,
  Target,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DatePicker } from "../components/DatePicker";
import { FUTURE_TRAIT_META, GOAL_ICON_SET, HabitIcon } from "../components/Icons";
import { LifeLine } from "../components/LifeLine";
import { addDays, ageOn, formatLong } from "../lib/dates";
import { ApiError } from "../lib/api";
import { useJourney } from "../lib/journey";
import { type GoalKind } from "../lib/progress";
import { FUTURE_TRAITS, FUTURE_YEARS, MAX_FUTURE_STATEMENT, MAX_FUTURE_TRAITS, type FutureTrait } from "@ascend/shared";

/** a journey starts with exactly one habit; the second slot opens at Level 3 */
const MAX_START_HABITS = 1;

type GoalType = { id: GoalKind; label: string; hint: string; examples: string[] };

const GOAL_TYPES: GoalType[] = [
  { id: "course", label: "A course", hint: "Finish what you start", examples: ["Finish an online course in data analysis", "Complete a beginner Spanish course"] },
  { id: "streak", label: "A streak", hint: "Show up every day", examples: ["Work out 30 days in a row", "Read every day for 21 days"] },
  { id: "position", label: "A position", hint: "Reach a role or rank", examples: ["Get promoted to team lead", "Land my first developer job"] },
  { id: "milestone", label: "A milestone", hint: "Hit one clear marker", examples: ["Run my first 5K", "Save my first $1,000"] },
];

type Preset = {
  name: string;
  icon: string;
  /** goal types this habit supports best */
  fits: GoalKind[];
  when: string;
  tiny: string;
  next: string;
};

const PRESETS: Preset[] = [
  {
    name: "Study 30 minutes",
    icon: "graduation",
    fits: ["course"],
    when: "Same desk, same time every day, so your brain knows it’s study time.",
    tiny: "Open the course and finish one lesson. That’s a win.",
    next: "Next time, pick up exactly where you stopped. Leave the tab open tonight.",
  },
  {
    name: "Deep work: 2 hours",
    icon: "laptop",
    fits: ["position", "course"],
    when: "First thing in your workday, before email and chat.",
    tiny: "Start with one 25-minute focus block, phone in another room.",
    next: "Next time, write the one thing you’ll work on before you start.",
  },
  {
    name: "Read 20 pages",
    icon: "book",
    fits: ["course", "milestone"],
    when: "With your morning coffee, or right before bed.",
    tiny: "On a rough day, 2 pages still counts. Keep the book open.",
    next: "Next time, leave the book where you’ll see it: on your pillow or desk.",
  },
  {
    name: "Workout",
    icon: "dumbbell",
    fits: ["streak", "milestone"],
    when: "Same time daily. Lay out your clothes the night before.",
    tiny: "Busy day? 10 minutes counts. Just get moving.",
    next: "Next time, add 5 minutes or one more set, only if today felt easy.",
  },
  {
    name: "Drink 2L of water",
    icon: "droplet",
    fits: ["streak"],
    when: "Fill a bottle as soon as you wake up; finish it by lunch.",
    tiny: "Start with one full glass right after waking.",
    next: "Next time, keep the bottle in sight. Out of sight is out of mind.",
  },
  {
    name: "Meditate 10 minutes",
    icon: "wind",
    fits: ["streak"],
    when: "Right after you wake up, before you touch your phone.",
    tiny: "Two minutes of slow breathing is enough to begin.",
    next: "Next time, same spot, same time. Add a minute when it feels short.",
  },
  {
    name: "Journal",
    icon: "pen",
    fits: ["streak", "milestone"],
    when: "Last thing before bed.",
    tiny: "One sentence: what moved me closer to my goal today?",
    next: "Next time, reread yesterday’s line first. Notice the progress.",
  },
  {
    name: "Learn something new",
    icon: "sprout",
    fits: ["course", "position"],
    when: "During your lunch break or commute.",
    tiny: "One short lesson, one video, or one page of notes.",
    next: "Next time, write down one thing you learned and how you’ll use it.",
  },
  {
    name: "Plan tomorrow",
    icon: "target",
    fits: ["position", "milestone"],
    when: "At the end of your workday, before you switch off.",
    tiny: "Write tomorrow’s single most important task.",
    next: "Next time, do that task first, before anything else.",
  },
  {
    name: "Reach out to one person",
    icon: "users",
    fits: ["position"],
    when: "Mid-morning, after your first focus block.",
    tiny: "One message to a colleague, mentor or someone in the role you want.",
    next: "Next time, follow up with someone from your last message, or pick someone new.",
  },
];

const GENERAL_HABITS = ["Deep work: 2 hours", "Read 20 pages", "Workout", "Plan tomorrow"];

/** the three steps that make any habit stick, in order */
const GUIDE = [
  { key: "when", label: "When", icon: Clock },
  { key: "tiny", label: "Start tiny", icon: Sprout },
  { key: "next", label: "Next time", icon: ArrowRight },
] as const;

const CUSTOM_TIPS = {
  when: "Pick a fixed time and attach it to something you already do: after coffee, after lunch, before bed.",
  tiny: "Make the first version so small you can’t say no. You can grow it later.",
  next: "Next time, do it at the same time and place. Repetition is what makes it stick.",
};

type Draft = { name: string; icon: string };

const STEPS = ["Welcome", "Your life", "Future you", "Your goal", "Habits", "Your plan", "Begin"] as const;
/** step indexes by name */
const S = { welcome: 0, life: 1, future: 2, goal: 3, habits: 4, plan: 5, begin: 6 } as const;
const stepLabel = (i: number) => `Step ${i + 1} of ${STEPS.length}`;

/** icon shown on each step's header and collapsed pill */
const STEP_META: { icon: LucideIcon }[] = [
  { icon: Sparkles },
  { icon: Cake },
  { icon: Telescope },
  { icon: Target },
  { icon: Repeat },
  { icon: MapIcon },
  { icon: Rocket },
];

/**
 * First sign-in: configure your journey before it starts.
 * Day 1 is the moment you press "Begin", never earlier.
 */
export function Onboarding({ today, name, onBegin }: { today: string; name?: string | null; onBegin: () => void }) {
  const firstName = name?.trim().split(/\s+/)[0] ?? "";
  const { data, actions } = useJourney();
  const openGoal = data.goals.find((g) => g.main && !g.achievedAt);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [birthday, setBirthday] = useState(() => data.profile.birthday ?? "");
  const [goalKind, setGoalKind] = useState<GoalKind | null>(() => openGoal?.kind ?? null);
  const [goalTitle, setGoalTitle] = useState(() => openGoal?.title ?? "");
  const [picked, setPicked] = useState<Draft[]>(() =>
    data.habits
      .filter((h) => !h.archivedAt)
      .map(({ name, icon }) => ({ name, icon }))
      .slice(0, MAX_START_HABITS),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  // Day 1 can be today, or tomorrow for a clean start
  const [startsTomorrow, setStartsTomorrow] = useState(false);
  const dayOne = startsTomorrow ? addDays(today, 1) : today;
  // "Future you" is optional: the step can be skipped
  const [futureStatement, setFutureStatement] = useState(() => data.profile.future.statement ?? "");
  const [futureYears, setFutureYears] = useState<number>(() => data.profile.future.years ?? 5);
  const [futureTraits, setFutureTraits] = useState<FutureTrait[]>(() => data.profile.future.traits);
  const futureText = futureStatement.trim();
  const hasFuture = futureText.length > 0;
  const toggleTrait = (t: FutureTrait) =>
    setFutureTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(-MAX_FUTURE_TRAITS)));
  const futureInput = { statement: futureText || null, years: hasFuture || futureTraits.length ? futureYears : null, traits: futureTraits };
  const [custom, setCustom] = useState("");
  const [launching, setLaunching] = useState(false);

  const kind = GOAL_TYPES.find((k) => k.id === goalKind) ?? null;
  const goal = goalTitle.trim();

  const isPicked = (name: string) => picked.some((p) => p.name === name);
  // picking beyond the limit replaces the oldest pick
  const toggle = (d: Draft) =>
    setPicked((prev) => (isPicked(d.name) ? prev.filter((p) => p.name !== d.name) : [d]));
  const addCustom = () => {
    const name = custom.trim();
    if (name && !isPicked(name)) setPicked([{ name, icon: "star" }]);
    setCustom("");
  };

  // every goal type has its own recommended habits; anything else picked (own habits, or from another type) stays visible
  // an idea narrows the habit suggestions; without one, a general starter set
  const recommended = kind ? PRESETS.filter((p) => p.fits.includes(kind.id)) : PRESETS.filter((p) => GENERAL_HABITS.includes(p.name));
  const extraPicks = picked.filter((p) => !recommended.some((x) => x.name === p.name));

  const canNext =
    step === S.life ? Boolean(birthday) && birthday <= today : step === S.goal ? goal.length >= 3 : step === S.habits ? picked.length > 0 : true;

  const go = (to: number) => {
    setDir(to > step ? "fwd" : "back");
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // saving runs during the finale animation; the dashboard opens once both are done
  const launch = async () => {
    if (launching) return;
    setLaunching(true);
    setSaveError(null);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finale = new Promise((r) => window.setTimeout(r, calm ? 0 : 2000));
    const save = actions.start({
      birthday,
      future: futureInput,
      startsOn: dayOne,
      goal: { title: goal, kind: goalKind },
      habits: picked.map(({ name, icon }) => ({ name, icon })),
    });
    try {
      const [saved] = await Promise.all([save, finale]);
      // both in one batch: the loader takes over as the saved journey arrives
      onBegin();
      actions.replace(saved);
    } catch (err) {
      await finale;
      setLaunching(false);
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save your journey. Check your connection and try again.");
    }
  };

  const chip = (h: Draft, rec = false) => (
    <button
      key={h.name}
      type="button"
      className={`ob-chip ${isPicked(h.name) ? "on" : ""} ${rec ? "rec" : ""}`}
      aria-pressed={isPicked(h.name)}
      onClick={() => toggle(h)}
    >
      <HabitIcon name={h.icon} size={16} />
      {h.name}
      {isPicked(h.name) && <Check className="ob-chip-check" size={14} aria-hidden="true" />}
    </button>
  );

  const last = STEPS.length - 1;
  const pct = Math.round((step / last) * 100);
  const age = birthday ? ageOn(birthday, today) : null;
  // what a finished step shows on its collapsed pill
  const doneValue = (i: number) =>
    [
      "Done",
      age !== null ? `Age ${age}` : "Done",
      hasFuture ? `In ${futureYears} yrs` : futureTraits.length ? futureTraits.map((t) => FUTURE_TRAIT_META[t].label).join(", ") : "Skipped",
      goal || "Done",
      picked[0]?.name ?? "Done",
      "Ready",
      "",
    ][i];
  const StepIcon = STEP_META[step].icon;
  const next = () => canNext && go(step + 1);

  // up to two steps ahead sit above the card (nearest closest), up to two finished ones below
  const ahead = [step + 2, step + 1].filter((i) => i <= last);
  const behind = [step - 1, step - 2].filter((i) => i >= 0);

  const nextButton = (extra = "", label = step === S.welcome ? "Let’s start" : "Next Step") => (
    <button type="button" className={`ob-pill-btn next ${extra}`} disabled={!canNext} onClick={next}>
      {label}
      <Play size={9} fill="currentColor" aria-hidden="true" />
    </button>
  );

  return (
    <div className={`onboarding ${launching ? "launching" : ""}`}>

      {launching && (
        <div className="ob-finale" role="status">
          <div className="ob-fin from">
            <small>From</small>
            <span>Day 1 · {formatLong(dayOne)}</span>
          </div>
          <div className="ob-fin done">Done!</div>
          <div className="ob-fin to">
            <small>To</small>
            <span>{goal}</span>
          </div>
        </div>
      )}

      <div className="ob-flow">
        <ol className="ob-stack ahead" aria-label="Steps ahead">
          {ahead.map((i) => {
            const Icon = STEP_META[i].icon;
            return (
              <li key={STEPS[i]} className={`ob-pill d${i - step}`}>
                <Icon size={18} aria-hidden="true" />
                <span className="ob-pill-name">{STEPS[i]}</span>
              </li>
            );
          })}
        </ol>

      <section className="ob-card" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        <header className="ob-head">
          <div className="ob-head-name">
            <StepIcon size={20} aria-hidden="true" />
            <span key={step}>{STEPS[step]}</span>
          </div>
          <Ring pct={pct} />
          <div className="ob-head-nav">
            {step > 0 && step < last && (
              <button type="button" className="ob-pill-btn icon" onClick={() => go(step - 1)} aria-label="Last step" title="Last step">
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
            )}
            {step === S.welcome ? null : step < last ? (
              nextButton()
            ) : (
              <button type="button" className="ob-pill-btn" onClick={() => go(step - 1)} disabled={launching}>
                <Play size={9} fill="currentColor" className="flip" aria-hidden="true" />
                Last Step
              </button>
            )}
          </div>
        </header>

        <AutoHeight>
        {step === S.welcome && (
          <div key="s0" className={`ob-body center ${dir}`}>
            <img src="/brand/ascend-icon.png" alt="Ascend" className="ob-logo" />
            <h1 className="ob-title">
              Welcome{firstName ? (
                <>
                  , <span className="gradient-text shimmer">{firstName}</span>
                </>
              ) : null}
              .
            </h1>
            <p className="ob-slogan">
              From today, you don’t count the days, you <span className="gradient-text shimmer">make the days count</span>.
            </p>
            <p className="muted ob-lead">
              Take a minute to set up your journey. You’ll map your life, picture who you want to become, choose your first goal
              and the habits that get you there. Then Day 1 begins.
            </p>
            <ol className="ob-stages" aria-label="Your journey">
              {[
                ["stage-cocoon", "Break limits"],
                ["stage-butterfly", "Evolve"],
                ["stage-ascend", "Achieve more"],
              ].map(([img, label], i) => (
                <li key={img} style={{ "--i": i } as CSSProperties}>
                  {i > 0 && <ArrowRight className="ob-arrow" size={18} aria-hidden="true" />}
                  <figure>
                    <img src={`/brand/${img}.png`} alt="" />
                    <figcaption>{label}</figcaption>
                  </figure>
                </li>
              ))}
            </ol>
            {nextButton("solid")}
          </div>
        )}

        {step === S.life && (
          <div key="s1" className={`ob-body ${dir}`}>
            <Stat label={stepLabel(S.life)} title="When were you born?" side={{ label: "Age", value: age !== null ? String(age) : "–" }} />
            <p className="muted">We use it to map your life. It’s saved to your account and never shared.</p>
            <DatePicker value={birthday} max={today} onChange={setBirthday} label="Your birthday" />
          </div>
        )}

        {step === S.future && (
          <div key="sf" className={`ob-body ${dir}`}>
            <Stat
              label={stepLabel(S.future)}
              title="Who do you want to become?"
              side={{ label: "By age", value: age !== null ? String(age + futureYears) : "–" }}
            />
            <p className="muted">
              Picture yourself a few years from now: not a task, a person. Every goal and habit you add will move you toward
              them. <strong className="age">Optional</strong>, skip it if nothing comes to mind yet.
            </p>

            <p className="ob-section">
              <Clock size={13} aria-hidden="true" /> How far ahead?
            </p>
            <div className="ob-try ob-years" role="radiogroup" aria-label="Years ahead">
              {FUTURE_YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  role="radio"
                  aria-checked={futureYears === y}
                  className={`ob-try-chip ${futureYears === y ? "on" : ""}`}
                  onClick={() => setFutureYears(y)}
                >
                  {y} {y === 1 ? "year" : "years"}
                </button>
              ))}
            </div>

            <label className="ob-label" htmlFor="ob-future">
              In {futureYears} {futureYears === 1 ? "year" : "years"}, I am someone who…
            </label>
            <input
              id="ob-future"
              className="ob-input wide"
              maxLength={MAX_FUTURE_STATEMENT}
              placeholder="e.g. trains 4 times a week and works as a data analyst"
              value={futureStatement}
              onChange={(e) => setFutureStatement(e.target.value)}
            />

            <p className="ob-section">
              <Sparkles size={13} aria-hidden="true" /> In a word or three <span className="muted">(up to {MAX_FUTURE_TRAITS})</span>
            </p>
            <div className="ob-chips" aria-label="Traits">
              {FUTURE_TRAITS.map((t) => {
                const { label, icon: Icon } = FUTURE_TRAIT_META[t];
                const on = futureTraits.includes(t);
                return (
                  <button key={t} type="button" className={`ob-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleTrait(t)}>
                    <Icon size={16} aria-hidden="true" />
                    {label}
                    {on && <Check className="ob-chip-check" size={14} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            <div className="ob-tip">
              <Lightbulb className="ob-tip-icon" size={18} aria-hidden="true" />
              <p>
                Describe who you are, not what you own. <span className="good">“Someone who runs every morning”</span> pulls harder
                than <span className="bad">“Thin”</span>.
              </p>
            </div>
            <EditLater>Don’t worry, you can change it later.</EditLater>
          </div>
        )}

        {step === S.goal && (
          <div key="s2" className={`ob-body ${dir}`}>
            <Stat label={stepLabel(S.goal)} title="Pick your first goal." />
            {hasFuture && (
              <p className="ob-toward">
                <Telescope size={15} aria-hidden="true" />
                <span>
                  First step toward someone who <strong>{futureText}</strong>
                </span>
              </p>
            )}
            <p className="muted">
              It can be simple or hard, but we recommend <strong className="age">simple yet effective</strong>: one clear thing
              you’ll know you’ve finished.
            </p>

            <p className="ob-section">
              <Lightbulb size={13} aria-hidden="true" /> Need an idea?
            </p>
            <div className="ob-kinds" aria-label="Goal ideas">
              {GOAL_TYPES.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={goalKind === k.id}
                  className={`ob-kind ${goalKind === k.id ? "on" : ""}`}
                  onClick={() => setGoalKind(goalKind === k.id ? null : k.id)}
                >
                  <span className="ob-kind-icon" aria-hidden="true">
                    <GoalIcon kind={k.id} size={22} />
                  </span>
                  <strong>{k.label}</strong>
                  <small>{k.hint}</small>
                </button>
              ))}
            </div>

            <label className="ob-label" htmlFor="ob-goal">
              Say it in one sentence
            </label>
            {kind && (
              <div key={kind.id} className="ob-try">
                <span className="muted small">Try:</span>
                {kind.examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className={`ob-try-chip ${goalTitle === ex ? "on" : ""}`}
                    aria-pressed={goalTitle === ex}
                    onClick={() => setGoalTitle(ex)}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <input
              id="ob-goal"
              className="ob-input wide"
              maxLength={90}
              placeholder={kind ? `e.g. ${kind.examples[0]}` : "e.g. Finish an online course in data analysis"}
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
            />
            <div className="ob-tip">
              <Lightbulb className="ob-tip-icon" size={18} aria-hidden="true" />
              <p>
                Specific beats big. <span className="good">“Run my first 5K”</span> works better than{" "}
                <span className="bad">“Get fit”</span>.
              </p>
            </div>
            <EditLater>Don’t worry, you can edit your goal later.</EditLater>
          </div>
        )}

        {step === S.habits && (
          <div key="s3" className={`ob-body ${dir}`}>
            <Stat label={stepLabel(S.habits)} title="Choose one habit that supports your goal." />
            <p className="muted">
              Goal: <strong className="age">{goal}</strong>.
            </p>

            <ul className="ob-rules" aria-label="The rules">
              <li>
                <span className="ob-rules-num">1</span>
                <span>
                  <strong>Choose only one.</strong> One habit you actually do beats three you skip.
                </span>
              </li>
              <li>
                <span className="ob-rules-num">2</span>
                <span>
                  <strong>Make it small.</strong> Small enough that a bad day can’t stop you.
                </span>
              </li>
              <li>
                <span className="ob-rules-num">3</span>
                <span>
                  <strong>Do it every single day.</strong> That’s what matters most.
                </span>
              </li>
            </ul>

            <p className="ob-section">
              <Sparkles size={13} aria-hidden="true" /> Recommended for your goal <span className="muted">(pick one)</span>
            </p>
            <div className="ob-chips">
              {recommended.map((h) => chip(h, true))}
              {extraPicks.map((h) => chip(h))}
            </div>

            <form
              className="ob-add"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <input className="ob-input" placeholder="Or write your own, keep it small…" maxLength={60} value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button type="submit" className="ghost-btn" disabled={!custom.trim()}>
                Add
              </button>
            </form>
            <p className="ob-count" aria-live="polite">
              <span className="ob-count-dots" aria-hidden="true">
                {Array.from({ length: MAX_START_HABITS }, (_, i) => (
                  <i key={i} className={i < picked.length ? "on" : ""} />
                ))}
              </span>
              {picked.length === 0 ? (
                "Pick one to continue"
              ) : (
                <span>
                  Your habit: <strong>{picked[0].name}</strong>. Every day, starting Day 1.
                </span>
              )}
            </p>
            <EditLater>You can change it later. Your second habit slot opens at Level 3.</EditLater>
          </div>
        )}

        {step === S.plan && (
          <div key="s4" className={`ob-body ${dir}`}>
            <Stat label={stepLabel(S.plan)} title="Here’s how you’ll make it happen." side={{ label: "Every day", value: "1" }} />
            <p className="muted">
              <strong className="age">{picked[0]?.name}</strong> is your small daily step toward <strong className="age">{goal}</strong>.
            </p>

            {/* the same three steps for every habit: shown once, with a habit's own tip only when it has one */}
            <ol className="ob-guide">
              {GUIDE.map(({ key, label, icon: Icon }, i) => {
                const specific = picked.flatMap((h) => {
                  const preset = PRESETS.find((x) => x.name === h.name);
                  return preset ? [{ habit: h, tip: preset[key] }] : [];
                });
                return (
                  <li key={key} style={{ "--i": i } as CSSProperties}>
                    <span className="ob-guide-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3>
                        <Icon size={15} aria-hidden="true" /> {label}
                      </h3>
                      <p>{CUSTOM_TIPS[key]}</p>
                      {specific.map(({ habit, tip }) => (
                        <p key={habit.name} className="ob-guide-for">
                          <HabitIcon name={habit.icon} size={14} />
                          <span>
                            <b>{habit.name}:</b> {tip}
                          </span>
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>

            <h3 className="ob-sub">What happens next</h3>
            <ol className="ob-timeline">
              <li>
                <b>{startsTomorrow ? "Tomorrow" : "Today"} · Day 1</b>
                <span>Do your habit once, then check it off on your dashboard.</span>
              </li>
              <li>
                <b>Days 2 to 7</b>
                <span>Same time, same place. Keep the chain going: 7 days in a row and you evolve.</span>
              </li>
              <li>
                <b>If you miss a day</b>
                <span>No guilt. Just never miss twice: show up the very next day.</span>
              </li>
              <li>
                <b>As you level up</b>
                <span>Daily tasks, more habit slots and goal tracking unlock, one step at a time.</span>
              </li>
            </ol>
          </div>
        )}

        {step === S.begin && (
          <div key="s5" className={`ob-body ${dir}`}>
            <Stat label={stepLabel(S.begin)} title="Are you ready to begin?" side={{ label: "Day 1", value: startsTomorrow ? "Tomorrow" : "Today" }} />

            <p className="ob-section">
              <CalendarDays size={13} aria-hidden="true" /> When is your Day 1?
            </p>
            <div className="ob-dayone" role="radiogroup" aria-label="When is your Day 1?">
              {[false, true].map((tomorrow) => (
                <button
                  key={String(tomorrow)}
                  type="button"
                  role="radio"
                  aria-checked={startsTomorrow === tomorrow}
                  className={`ob-dayone-opt ${startsTomorrow === tomorrow ? "on" : ""}`}
                  onClick={() => setStartsTomorrow(tomorrow)}
                >
                  <strong>{tomorrow ? "Tomorrow" : "Today"}</strong>
                  <small>{formatLong(tomorrow ? addDays(today, 1) : today)}</small>
                  <span>{tomorrow ? "A clean start in the morning" : "Start right now, check off today"}</span>
                </button>
              ))}
            </div>
            <p className="muted">
              {startsTomorrow ? (
                <>
                  Your journey starts tomorrow, <strong className="age">{formatLong(dayOne)}</strong>. Tonight, decide when you’ll do{" "}
                  your habit.
                </>
              ) : (
                <>
                  Day 1 starts the moment you press begin: <strong className="age">{formatLong(today)}</strong>.
                </>
              )}
            </p>

            <dl className="ob-stops">
              {hasFuture && (
                <div>
                  <dt>Future you</dt>
                  <dd>
                    <Telescope size={16} aria-hidden="true" />
                    Someone who {futureText}
                  </dd>
                </div>
              )}
              <div>
                <dt>Goal</dt>
                <dd>
                  {kind && <GoalIcon kind={kind.id} size={16} />}
                  {goal}
                </dd>
              </div>
              <div>
                <dt>Habit</dt>
                <dd className="ob-stops-habits">
                  {picked.map((p) => (
                    <span key={p.name}>
                      <HabitIcon name={p.icon} size={15} /> {p.name}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>

            <LifePreview birthday={birthday} today={today} dayOne={dayOne} future={hasFuture ? futureInput : null} />

            {saveError && (
              <p className="auth-error ob-save-error" role="alert">
                {saveError}
              </p>
            )}
            <button type="button" className="ob-go" onClick={launch} disabled={launching}>
              {startsTomorrow ? "Yes, start tomorrow" : "Yes, begin Day 1"}
            </button>
          </div>
        )}

        </AutoHeight>

        {/* a Continue at the end of every step; on phones it stays pinned to the bottom of the screen */}
        {step > 0 && step < last && <div className="ob-foot">{nextButton("wide", step === S.future && !hasFuture && !futureTraits.length ? "Skip for now" : "Continue")}</div>}
      </section>

        <ol className="ob-stack behind" aria-label="Finished steps">
          {behind.map((i) => {
            const Icon = STEP_META[i].icon;
            return (
              <li key={STEPS[i]} className={`ob-pill d${step - i}`}>
                <button type="button" onClick={() => go(i)} disabled={launching} aria-label={`Back to ${STEPS[i]}`}>
                  <Icon size={18} aria-hidden="true" />
                  <span className="ob-pill-name">{STEPS[i]}</span>
                  <span className="ob-pill-val">{doneValue(i)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function EditLater({ children }: { children: ReactNode }) {
  return (
    <p className="ob-later">
      <PenLine size={14} aria-hidden="true" />
      {children}
    </p>
  );
}

function GoalIcon({ kind, size }: { kind: GoalKind; size: number }) {
  const Icon = GOAL_ICON_SET[kind];
  return <Icon size={size} aria-hidden="true" />;
}

/** grows and shrinks smoothly as the step's content changes height */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ob-stage" style={{ height }}>
      <div ref={inner} className="ob-stage-inner">
        {children}
      </div>
    </div>
  );
}


/** the video's stat row: small label over a big light value, with a second one on the right */
function Stat({ label, title, side }: { label: string; title: string; side?: { label: string; value: string } }) {
  return (
    <div className="ob-stat">
      <div>
        <small>{label}</small>
        <h2 className="ob-h">{title}</h2>
      </div>
      {side && (
        <div className="ob-stat-side">
          <small>{side.label}</small>
          <strong>{side.value}</strong>
        </div>
      )}
    </div>
  );
}

/** circular progress with the percentage inside, like the video's header ring */
function Ring({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="ob-ring" role="img" aria-label={`${pct}% set up`}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="track" cx="24" cy="24" r={r} />
        <circle className="fill" cx="24" cy="24" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 24 24)" />
      </svg>
      <span>{pct}%</span>
    </div>
  );
}

function LifePreview({
  birthday,
  today,
  dayOne = today,
  future,
}: {
  birthday: string;
  today: string;
  /** when Day 1 is (today or tomorrow) */
  dayOne?: string;
  future?: { statement: string | null; years: number | null } | null;
}) {
  const age = ageOn(birthday, dayOne);

  return (
    <div className="ob-life">
      <p className="ob-life-title">
        This is your life. <span className="muted">You are {age}. {dayOne === today ? "Today" : "Tomorrow"} becomes Day 1.</span>
      </p>
      <LifeLine age={age} journeyDay={1} bornLabel={formatLong(birthday)} todayLabel={formatLong(dayOne)} future={future} />
    </div>
  );
}
