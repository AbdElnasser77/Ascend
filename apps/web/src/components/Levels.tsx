import { Lock, LockOpen } from "lucide-react";
import {
  HABIT_MILESTONES,
  SECOND_CHANCE,
  TIERS,
  UNLOCK_STEPS,
  XP,
  describeRequirement,
  unlocksBetween,
  type JourneyState,
  type Tier,
} from "@ascend/shared";
import { useEffect, useState, type CSSProperties } from "react";

export const stageSrc = (t: Tier) => `/levels/${t.image}.png`;

/**
 * The form you've grown into. `momentum` (0..1, last 7 days) sets how brightly it glows:
 * keep showing up and it shines, slack off and it dims. Your level never drops.
 */
export function LevelArt({ tier, momentum, size = 220 }: { tier: Tier; momentum: number; size?: number }) {
  const style = { "--size": `${size}px`, "--shine": 0.55 + 0.45 * momentum, "--sat": 0.6 + 0.4 * momentum } as CSSProperties;
  return (
    <div className="level-star" style={style}>
      <div className="level-star-glow" />
      <img src={stageSrc(tier)} alt={tier.name} draggable={false} />
    </div>
  );
}

const statusOf = (t: Tier, i: number, level: number) => {
  const nextAt = TIERS[i + 1]?.level ?? Infinity;
  return level >= nextAt || (t.level === 100 && level >= 100) ? "completed" : level >= t.level ? "current" : "locked";
};

/** "Your Evolution" card on Home: current form, XP, and exactly what it takes to evolve next */
export function EvolutionCard({ state, momentum, onOpen }: { state: JourneyState; momentum: number; onOpen: () => void }) {
  const { tier, nextTier, gate, level } = state;
  const stageNo = TIERS.indexOf(tier) + 1;
  const coming = nextTier ? unlocksBetween(level, nextTier.level) : [];

  return (
    <section className="card star-card">
      <div className="card-head">
        <h2 className="title-icon">
          Your Evolution
          <span className="info" title="Earn XP from habits, goals and tasks to level up. To evolve into the next form, you also need proof of change: habits kept, goals achieved. Your level never drops.">
            i
          </span>
        </h2>
        <span className="level-chip">Level {level}</span>
      </div>

      <LevelArt tier={tier} momentum={momentum} />

      <p className="stage-count">
        Stage {stageNo} of {TIERS.length}
      </p>
      <p className="tier-name">{tier.name}</p>
      <p className="muted center">{tier.meaning}</p>

      <div className="xp">
        <div className={`progress ${state.blocked ? "full" : ""}`} aria-hidden="true">
          <div className="progress-fill" style={{ width: `${(state.blocked ? 1 : state.pct) * 100}%` }} />
        </div>
        <span>
          {level >= 100 ? (
            "Max level reached"
          ) : state.blocked ? (
            <>
              <b>XP ready</b> for Level {nextTier!.level}. Evolve to unlock it.
            </>
          ) : (
            <>
              <b>{state.intoLevel.toLocaleString()}</b> / {state.levelSpan.toLocaleString()} XP to <b>Level {level + 1}</b>
            </>
          )}
        </span>
      </div>

      {gate && nextTier && (
        <div className="evolve">
          <p className="evolve-title">
            Evolve into <b>{nextTier.name}</b>
          </p>
          <ul className="reqs">
            <li className={state.xpLevel >= nextTier.level ? "met" : ""}>
              <i aria-hidden="true" />
              <span>Reach Level {nextTier.level}</span>
              <em>
                {Math.min(state.xpLevel, nextTier.level)}/{nextTier.level}
              </em>
            </li>
            {gate.requirements.map((r) => (
              <li key={r.label} className={r.met ? "met" : ""}>
                <i aria-hidden="true" />
                <span>{r.label}</span>
                <em>
                  {r.have}/{r.need}
                </em>
              </li>
            ))}
          </ul>
          {coming.length > 0 && (
            <p className="unlock-line">
              <LockOpen size={13} aria-hidden="true" className="inline-ico" /> Next unlocks: {coming.map((u) => `${u.label} (Lv ${u.level})`).join(" · ")}
            </p>
          )}
        </div>
      )}

      <button className="primary-btn wide" onClick={onOpen}>
        See all levels →
      </button>
      <p className="muted small center">{state.xp.toLocaleString()} XP earned in total</p>
    </section>
  );
}

export function LevelsModal({ state, onClose }: { state: JourneyState; onClose: () => void }) {
  const { level } = state;
  const currentIdx = TIERS.indexOf(state.tier);
  const [picked, setPicked] = useState(Math.min(currentIdx + 1, TIERS.length - 1));
  const sel = TIERS[picked];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const selStatus = statusOf(sel, picked, level);
  // unlocks that belong to this stage: from its first level up to the next stage
  const until = TIERS[picked + 1]?.level ?? Infinity;
  const selUnlocks = UNLOCK_STEPS.filter((u) => u.level >= sel.level && u.level < until);
  const isNext = state.nextTier?.level === sel.level;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal levels-modal" role="dialog" aria-modal="true" aria-labelledby="levels-title" onClick={(e) => e.stopPropagation()}>
        <div className="lm-head">
          <img src="/brand/ascend-icon.png" alt="" className="lm-icon" />
          <div className="lm-title">
            <h2 id="levels-title">Ascend</h2>
            <p>Your journey of transformation</p>
          </div>
          <div className="lm-level">
            <span>
              <b>✦</b> Level {level}
            </span>
            <div className="progress" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${(state.blocked ? 1 : state.pct) * 100}%` }} />
            </div>
            <small>{level >= 100 ? "Max level" : `${state.intoLevel.toLocaleString()} / ${state.levelSpan.toLocaleString()} XP`}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="levels-grid">
          {TIERS.map((t, i) => {
            const status = statusOf(t, i, level);
            return (
              <button
                key={t.level}
                className={`level-card ${status} ${t.level === 100 ? "legend" : ""} ${picked === i ? "picked" : ""}`}
                onClick={() => setPicked(i)}
                aria-pressed={picked === i}
              >
                {status === "completed" && <span className="lc-badge" aria-label="Completed">✓</span>}
                <div className="level-card-img">
                  <img src={stageSrc(t)} alt="" draggable={false} />
                </div>
                <span className="lc-level">Level {t.level}</span>
                <span className="lc-name">{t.name}</span>
                <span className={`lc-status ${status}`}>
                  {status === "completed" ? (
                    "✓ Completed"
                  ) : status === "current" ? (
                    "✦ You are here"
                  ) : (
                    <>
                      <Lock size={11} aria-hidden="true" className="inline-ico" /> Locked
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="lm-detail">
          <div>
            <p className="lm-detail-kicker">
              Level {sel.level} · Stage {picked + 1}
            </p>
            <h3>{sel.name}</h3>
            <p className="muted">{sel.meaning}</p>
          </div>
          <div>
            <p className="lm-detail-kicker">{selStatus === "locked" ? "To evolve into this form" : "How you got here"}</p>
            {sel.gate.length === 0 ? (
              <p className="muted small">Where every journey starts. Pick your first habit.</p>
            ) : (
              <ul className="reqs">
                <li className={level >= sel.level || state.xpLevel >= sel.level ? "met" : ""}>
                  <i aria-hidden="true" />
                  <span>Reach Level {sel.level}</span>
                </li>
                {sel.gate.map((r) => {
                  const live = isNext ? state.gate?.requirements.find((x) => x.label === describeRequirement(r)) : undefined;
                  const met = selStatus !== "locked" || live?.met;
                  return (
                    <li key={describeRequirement(r)} className={met ? "met" : ""}>
                      <i aria-hidden="true" />
                      <span>{describeRequirement(r)}</span>
                      {live && (
                        <em>
                          {live.have}/{live.need}
                        </em>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <p className="lm-detail-kicker">Unlocks</p>
            {selUnlocks.length ? (
              <ul className="unlocks">
                {selUnlocks.map((u) => (
                  <li key={u.label}>
                    {u.label}
                    {u.level !== sel.level && <small> · Lv {u.level}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{sel.level === 100 ? "The Eternal Flight form, for life." : "A new form for your journey."}</p>
            )}
          </div>
        </div>

        <details className="xp-guide">
          <summary>How XP works</summary>
          <div className="xp-guide-grid">
            <div>
              <b>Habits</b>
              <span>
                +{XP.habitBase} XP per check-in, up to +{XP.habitStreakBonusMax} more for a streak
              </span>
            </div>
            <div>
              <b>Habit milestones</b>
              <span>{HABIT_MILESTONES.map((m) => `${m.label} (${m.describe}) +${m.xp.toLocaleString()}`).join(" · ")}</span>
            </div>
            <div>
              <b>Goals</b>
              <span>
                +{XP.goal} XP each (up to {XP.goalsRewardedPerMonth} a month; the goal must be at least {XP.goalMinAgeDays} days old)
              </span>
            </div>
            <div>
              <b>Tasks</b>
              <span>
                +{XP.task} XP each, up to {XP.tasksPerDayCap} a day
              </span>
            </div>
            <div>
              <b>Perfect day</b>
              <span>+{XP.perfectDay} XP when everything planned is done</span>
            </div>
            <div>
              <b>Second Chance</b>
              <span>
                Missed a habit? Do it twice today to repair a day up to {SECOND_CHANCE.maxDaysBack} days back. Limited each month.
              </span>
            </div>
          </div>
        </details>

        <div className="lm-foot">
          <span>
            <b>✦</b> Keep going! Every habit brings you closer to your next form.
          </span>
          <div className="lm-dots" aria-label={`Stage ${currentIdx + 1} of ${TIERS.length}`}>
            {TIERS.map((t, i) => (
              <i key={t.level} className={i <= currentIdx ? "on" : ""} />
            ))}
            <img src="/levels/stage-60.png" alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
