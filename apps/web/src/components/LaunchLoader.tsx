import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const SETUP_STEPS = ["Saving your goal", "Adding your habits", "Mapping your life line", "Preparing your dashboard"];
const STEP_MS = 550;

/**
 * Shown while the dashboard loads.
 * After setup it walks through what's being configured; on a normal visit it's just the spinner.
 */
export function LaunchLoader({ setup = false, ready = true, onDone }: { setup?: boolean; ready?: boolean; onDone?: () => void }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!setup) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => setShown((n) => Math.min(n + 1, SETUP_STEPS.length)), calm ? 120 : STEP_MS);
    return () => window.clearInterval(id);
  }, [setup]);

  const listDone = shown >= SETUP_STEPS.length;
  // finish only once every line has ticked and the dashboard code has arrived
  useEffect(() => {
    if (!setup || !listDone || !ready) return;
    const id = window.setTimeout(() => onDone?.(), 450);
    return () => window.clearTimeout(id);
  }, [setup, listDone, ready, onDone]);

  const pct = setup ? Math.round((shown / SETUP_STEPS.length) * 100) : null;

  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader-mark">
        <span className="loader-ring" aria-hidden="true" />
        <img src="/brand/ascend-icon.png" alt="" />
      </div>
      <p className="loader-title">{setup ? (listDone ? "Your journey is ready" : "Setting up your journey") : "Loading your journey"}</p>

      {setup && (
        <>
          <ul className="loader-steps">
            {SETUP_STEPS.map((s, i) => (
              <li key={s} className={i < shown ? "done" : i === shown ? "now" : ""}>
                <span className="loader-tick" aria-hidden="true">
                  {i < shown && <Check size={12} strokeWidth={3} />}
                </span>
                {s}
              </li>
            ))}
          </ul>
          <div className="loader-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
