import {
  ArrowRight,
  Cake,
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
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DatePicker } from "../components/DatePicker";
import { GOAL_ICON_SET, HabitIcon } from "../components/Icons";
import { LifeLine } from "../components/LifeLine";
import { formatLong } from "../lib/dates";
import { newId, type Goal, type GoalKind, type Habit } from "../lib/progress";
import { readStored, writeStored } from "../lib/useStoredState";

/** one habit is ideal; two is the most a new journey starts with */
const MAX_START_HABITS = 2;

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

const CUSTOM_TIPS = {
  when: "Pick a fixed time and attach it to something you already do: after coffee, after lunch, before bed.",
  tiny: "Make the first version so small you can’t say no. You can grow it later.",
  next: "Next time, do it at the same time and place. Repetition is what makes it stick.",
};

type Draft = { name: string; icon: string };

const STEPS = ["Welcome", "Your life", "Your goal", "Habits", "Your plan", "Begin"] as const;

/** icon shown on each step's header and collapsed pill */
const STEP_META: { icon: LucideIcon }[] = [
  { icon: Sparkles },
  { icon: Cake },
  { icon: Target },
  { icon: Repeat },
  { icon: MapIcon },
  { icon: Rocket },
];

/**
 * First sign-in: configure your journey before it starts.
 * Day 1 is the moment you press "Begin", never earlier.
 */
export function Onboarding({ today, onBegin }: { today: string; onBegin: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [birthday, setBirthday] = useState(() => readStored<string | null>("ascend.birthday", null) ?? "");
  const [goalKind, setGoalKind] = useState<GoalKind | null>(
    () => readStored<Goal[]>("ascend.goals", []).find((g) => g.main && !g.achievedAt)?.kind ?? null,
  );
  const [goalTitle, setGoalTitle] = useState(() => readStored<Goal[]>("ascend.goals", []).find((g) => g.main && !g.achievedAt)?.title ?? "");
  const [picked, setPicked] = useState<Draft[]>(() =>
    readStored<Habit[]>("ascend.habits", [])
      .filter((h) => !h.archivedAt)
      .map(({ name, icon }) => ({ name, icon }))
      .slice(0, MAX_START_HABITS),
  );
  const [custom, setCustom] = useState("");
  const [launching, setLaunching] = useState(false);

  const kind = GOAL_TYPES.find((k) => k.id === goalKind) ?? null;
  const goal = goalTitle.trim();

  const isPicked = (name: string) => picked.some((p) => p.name === name);
  // picking beyond the limit replaces the oldest pick
  const toggle = (d: Draft) =>
    setPicked((prev) => (isPicked(d.name) ? prev.filter((p) => p.name !== d.name) : [...prev, d].slice(-MAX_START_HABITS)));
  const addCustom = () => {
    const name = custom.trim();
    if (name && !isPicked(name)) setPicked((prev) => [...prev, { name, icon: "star" }].slice(-MAX_START_HABITS));
    setCustom("");
  };

  // every goal type has its own recommended habits; anything else picked (own habits, or from another type) stays visible
  // an idea narrows the habit suggestions; without one, a general starter set
  const recommended = kind ? PRESETS.filter((p) => p.fits.includes(kind.id)) : PRESETS.filter((p) => GENERAL_HABITS.includes(p.name));
  const extraPicks = picked.filter((p) => !recommended.some((x) => x.name === p.name));
  const tipsFor = (name: string) => PRESETS.find((p) => p.name === name) ?? CUSTOM_TIPS;

  const canNext =
    step === 1 ? Boolean(birthday) && birthday <= today : step === 2 ? goal.length >= 3 : step === 3 ? picked.length > 0 : true;

  const go = (to: number) => {
    setDir(to > step ? "fwd" : "back");
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const begin = () => {
    // reuse existing habit ids when names match; everything starts on Day 1 (today)
    const existing = readStored<Habit[]>("ascend.habits", []);
    const habits: Habit[] = picked.map(
      (p) => existing.find((h) => h.name === p.name && !h.archivedAt) ?? { id: newId(), name: p.name, icon: p.icon, createdAt: today },
    );
    // the first goal replaces any earlier (unfinished) first goal
    const goals = readStored<Goal[]>("ascend.goals", []).filter((g) => !(g.main && !g.achievedAt));
    writeStored("ascend.birthday", birthday);
    writeStored("ascend.startSlots", picked.length);
    writeStored("ascend.habits", habits.map((h) => ({ ...h, createdAt: today })));
    writeStored("ascend.goals", [...goals, { id: newId(), title: goal, kind: goalKind ?? undefined, main: true, createdAt: today }]);
    onBegin();
  };

  const launch = () => {
    if (launching) return;
    setLaunching(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(begin, calm ? 0 : 2000);
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
      goal || "Done",
      `${picked.length} ${picked.length === 1 ? "habit" : "habits"}`,
      "Ready",
      "",
    ][i];
  const StepIcon = STEP_META[step].icon;
  const next = () => canNext && go(step + 1);

  // up to two steps ahead sit above the card (nearest closest), up to two finished ones below
  const ahead = [step + 2, step + 1].filter((i) => i <= last);
  const behind = [step - 1, step - 2].filter((i) => i >= 0);

  const nextButton = (extra = "", label = step === 0 ? "Let’s start" : "Next Step") => (
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
            <span>Day 1 · {formatLong(today)}</span>
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
            {step === 0 ? null : step < last ? (
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
        {step === 0 && (
          <div key="s0" className={`ob-body center ${dir}`}>
            <img src="/brand/ascend-icon.png" alt="Ascend" className="ob-logo" />
            <h1 className="ob-title">
              Don’t count the days.
              <br />
              <span className="gradient-text shimmer">Make the days count.</span>
            </h1>
            <p className="muted ob-lead">
              Take a minute to set up your journey. You’ll map your life, choose your first goal, pick the habits that get you
              there, and then Day 1 begins.
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

        {step === 1 && (
          <div key="s1" className={`ob-body ${dir}`}>
            <Stat label="Step 2 of 6" title="When were you born?" side={{ label: "Age", value: age !== null ? String(age) : "–" }} />
            <p className="muted">We use it to map your life. It stays on this device.</p>
            <DatePicker value={birthday} max={today} onChange={setBirthday} label="Your birthday" />
            {birthday && birthday <= today && <LifePreview birthday={birthday} today={today} />}
          </div>
        )}

        {step === 2 && (
          <div key="s2" className={`ob-body ${dir}`}>
            <Stat label="Step 3 of 6" title="Pick your first goal." />
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

        {step === 3 && (
          <div key="s3" className={`ob-body ${dir}`}>
            <Stat label="Step 4 of 6" title="Add a habit or two to support it." side={{ label: "Chosen", value: `${picked.length}/${MAX_START_HABITS}` }} />
            <p className="muted">
              Goal: <strong className="age">{goal}</strong>. Habits are the small daily steps that get you there. One is perfect;
              two is the most to start with.
            </p>

            <p className="ob-section">
              <Sparkles size={13} aria-hidden="true" /> Recommended for your goal
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
              <input className="ob-input" placeholder="Or write your own…" maxLength={60} value={custom} onChange={(e) => setCustom(e.target.value)} />
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
              {picked.length === 0
                ? "Pick one to continue"
                : picked.length === 1
                  ? "1 habit. A great start."
                  : "2 habits. That’s the max for now."}
            </p>
            <EditLater>Don’t worry, you can change your habits later.</EditLater>
          </div>
        )}

        {step === 4 && (
          <div key="s4" className={`ob-body ${dir}`}>
            <Stat label="Step 5 of 6" title="Here’s how you’ll make it happen." side={{ label: "Habits", value: String(picked.length) }} />
            <p className="muted">
              Each habit is a small daily step toward <strong className="age">{goal}</strong>.
            </p>

            <div className="ob-plans">
              {picked.map((p) => {
                const t = tipsFor(p.name);
                return (
                  <article key={p.name} className="ob-plan">
                    <header>
                      <span className="ob-plan-icon" aria-hidden="true">
                        <HabitIcon name={p.icon} size={20} />
                      </span>
                      <h3>{p.name}</h3>
                    </header>
                    <dl>
                      <div>
                        <dt>
                          <Clock size={13} aria-hidden="true" /> When
                        </dt>
                        <dd>{t.when}</dd>
                      </div>
                      <div>
                        <dt>
                          <Sprout size={13} aria-hidden="true" /> Start tiny
                        </dt>
                        <dd>{t.tiny}</dd>
                      </div>
                      <div>
                        <dt>
                          <ArrowRight size={13} aria-hidden="true" /> Next time
                        </dt>
                        <dd>{t.next}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <h3 className="ob-sub">What happens next</h3>
            <ol className="ob-timeline">
              <li>
                <b>Today · Day 1</b>
                <span>Do {picked.length > 1 ? "each habit" : "your habit"} once, then check it off on your dashboard.</span>
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

        {step === 5 && (
          <div key="s5" className={`ob-body ${dir}`}>
            <Stat label="Step 6 of 6" title="Are you ready to begin?" side={{ label: "Day 1", value: "Today" }} />
            <p className="muted">
              Day 1 starts the moment you press begin: <strong className="age">{formatLong(today)}</strong>.
            </p>

            <dl className="ob-stops">
              <div>
                <dt>Goal</dt>
                <dd>
                  {kind && <GoalIcon kind={kind.id} size={16} />}
                  {goal}
                </dd>
              </div>
              <div>
                <dt>{picked.length > 1 ? "Habits" : "Habit"}</dt>
                <dd className="ob-stops-habits">
                  {picked.map((p) => (
                    <span key={p.name}>
                      <HabitIcon name={p.icon} size={15} /> {p.name}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>

            <LifePreview birthday={birthday} today={today} />

            <button type="button" className="ob-go" onClick={launch} disabled={launching}>
              Yes, begin Day 1
            </button>
          </div>
        )}

        </AutoHeight>

        {/* a Continue at the end of every step; on phones it stays pinned to the bottom of the screen */}
        {step > 0 && step < last && <div className="ob-foot">{nextButton("wide", "Continue")}</div>}
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

function ageOn(birthday: string, today: string) {
  let age = Number(today.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (today.slice(5) < birthday.slice(5)) age--;
  return age;
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

function LifePreview({ birthday, today }: { birthday: string; today: string }) {
  const age = ageOn(birthday, today);

  return (
    <div className="ob-life">
      <p className="ob-life-title">
        This is your life. <span className="muted">You are {age}. Today becomes Day 1.</span>
      </p>
      <LifeLine age={age} journeyDay={1} bornLabel={formatLong(birthday)} todayLabel={formatLong(today)} />
    </div>
  );
}
