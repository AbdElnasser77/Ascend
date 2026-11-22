import { useState } from "react";
import { LifeLine } from "../components/LifeLine";
import { addYears, daysBetween, formatLong } from "../lib/dates";
import { unlocksAt } from "@ascend/shared";
import { newId, type Habit } from "../lib/progress";
import { readStored, writeStored } from "../lib/useStoredState";

const LIFE_YEARS = 80;

const PRESETS: { name: string; icon: string }[] = [
  { name: "Deep work: 2 hours", icon: "💻" },
  { name: "Read 20 pages", icon: "📚" },
  { name: "Workout", icon: "🏃" },
  { name: "Drink 2L of water", icon: "💧" },
  { name: "Meditate 10 minutes", icon: "🧘" },
  { name: "Journal", icon: "✍️" },
  { name: "Learn something new", icon: "🌱" },
  { name: "Plan tomorrow", icon: "🎯" },
];

type Draft = { name: string; icon: string };

const STEPS = ["Welcome", "Your life", "First habit", "Begin"] as const;

/** a new journey starts at Level 1: one habit, so it can actually stick */
const FIRST_SLOTS = unlocksAt(1).habitSlots;

/**
 * First sign-in: configure your journey before it starts.
 * Day 1 is the moment you press "Begin Day 1", never earlier.
 */
export function Onboarding({ today, onBegin }: { today: string; onBegin: () => void }) {
  const [step, setStep] = useState(0);
  const [birthday, setBirthday] = useState(() => readStored<string | null>("ascend.birthday", null) ?? "");
  const [picked, setPicked] = useState<Draft[]>(() =>
    readStored<Habit[]>("ascend.habits", [])
      .filter((h) => !h.archivedAt)
      .map(({ name, icon }) => ({ name, icon }))
      .slice(0, FIRST_SLOTS),
  );
  const [custom, setCustom] = useState("");

  const isPicked = (name: string) => picked.some((p) => p.name === name);
  // picking beyond the free slots replaces the oldest pick
  const toggle = (d: Draft) =>
    setPicked((prev) => (isPicked(d.name) ? prev.filter((p) => p.name !== d.name) : [...prev, d].slice(-FIRST_SLOTS)));
  const addCustom = () => {
    const name = custom.trim();
    if (name && !isPicked(name)) setPicked((prev) => [...prev, { name, icon: "⭐" }].slice(-FIRST_SLOTS));
    setCustom("");
  };

  const canNext = step === 1 ? Boolean(birthday) && birthday <= today : step === 2 ? picked.length > 0 : true;

  const begin = () => {
    // reuse existing habit ids when names match; everything starts on Day 1 (today)
    const existing = readStored<Habit[]>("ascend.habits", []);
    const habits: Habit[] = picked.map(
      (p) => existing.find((h) => h.name === p.name && !h.archivedAt) ?? { id: newId(), name: p.name, icon: p.icon, createdAt: today },
    );
    writeStored("ascend.birthday", birthday);
    writeStored("ascend.habits", habits.map((h) => ({ ...h, createdAt: today })));
    onBegin();
  };

  return (
    <div className="onboarding">
      <div className="ob-card card">
        <div className="ob-steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={i < step ? "done" : i === step ? "on" : ""}>
              <i />
              {s}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className="ob-body center">
            <img src="/brand/ascend-icon.png" alt="Ascend" className="ob-logo" />
            <h1 className="ob-title">
              Don’t count the days.
              <br />
              <span className="gradient-text">Make the days count.</span>
            </h1>
            <p className="muted ob-lead">
              Before your journey starts, take a minute to set it up. We’ll map your life, choose your first habit, and then Day 1
              begins.
            </p>
            <ol className="ob-stages" aria-label="Your journey">
              {[
                ["stage-cocoon", "Break limits"],
                ["stage-butterfly", "Evolve"],
                ["stage-ascend", "Achieve more"],
              ].map(([img, label], i) => (
                <li key={img}>
                  {i > 0 && <span className="ob-arrow" aria-hidden="true">→</span>}
                  <figure>
                    <img src={`/brand/${img}.png`} alt="" />
                    <figcaption>{label}</figcaption>
                  </figure>
                </li>
              ))}
            </ol>
          </div>
        )}

        {step === 1 && (
          <div className="ob-body">
            <h2 className="ob-h">When were you born?</h2>
            <p className="muted">We use it to map your life. It stays on this device.</p>
            <input
              className="ob-input"
              type="date"
              value={birthday}
              max={today}
              onChange={(e) => setBirthday(e.target.value)}
              autoFocus
            />
            {birthday && birthday <= today && <LifePreview birthday={birthday} today={today} />}
          </div>
        )}

        {step === 2 && (
          <div className="ob-body">
            <h2 className="ob-h">Choose your first habit.</h2>
            <p className="muted">
              Just one. Real change starts small: keep it 7 days in a row and you’ll evolve. More habit slots unlock as you level up.
            </p>
            <div className="ob-chips">
              {[...PRESETS, ...picked.filter((p) => !PRESETS.some((x) => x.name === p.name))].map((h) => (
                <button key={h.name} type="button" className={`ob-chip ${isPicked(h.name) ? "on" : ""}`} aria-pressed={isPicked(h.name)} onClick={() => toggle(h)}>
                  <span aria-hidden="true">{h.icon}</span>
                  {h.name}
                  {isPicked(h.name) && <b aria-hidden="true">✓</b>}
                </button>
              ))}
            </div>
            <form
              className="ob-add"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <input className="ob-input" placeholder="Or write your own…" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button type="submit" className="ghost-btn" disabled={!custom.trim()}>
                Add
              </button>
            </form>
            <p className="muted small">{picked.length ? `Your first habit: ${picked[0].name}` : "Pick one to continue"}</p>
          </div>
        )}

        {step === 3 && (
          <div className="ob-body">
            <h2 className="ob-h">Your journey is ready.</h2>
            <p className="muted">
              Day 1 starts the moment you begin: <strong className="age">{formatLong(today)}</strong>.
            </p>
            <LifePreview birthday={birthday} today={today} />
            <div className="ob-summary">
              <span className="muted small">Your first habit</span>
              <ul>
                {picked.map((p) => (
                  <li key={p.name}>
                    <span aria-hidden="true">{p.icon}</span> {p.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="ob-nav">
          {step > 0 ? (
            <button type="button" className="ghost-btn" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary-btn" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {step === 0 ? "Set up my journey →" : "Continue →"}
            </button>
          ) : (
            <button type="button" className="primary-btn ob-begin" onClick={begin}>
              ✦ Begin Day 1
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LifePreview({ birthday, today }: { birthday: string; today: string }) {
  const end = addYears(birthday, LIFE_YEARS);
  const pct = (daysBetween(birthday, today) / daysBetween(birthday, end)) * 100;
  let age = Number(today.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (today.slice(5) < birthday.slice(5)) age--;

  return (
    <div className="ob-life">
      <p className="ob-life-title">
        This is your life. <span className="muted">You are {age}. Today becomes Day 1.</span>
      </p>
      <LifeLine pct={pct} journeyDay={1} bornLabel={formatLong(birthday)} todayLabel={formatLong(today)} endLabel={formatLong(end)} />
    </div>
  );
}
