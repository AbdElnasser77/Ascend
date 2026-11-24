import { FUTURE_TRAITS, FUTURE_YEARS, MAX_FUTURE_STATEMENT, MAX_FUTURE_TRAITS, type FutureTrait } from "@ascend/shared";
import { Check, PenLine, Plus, Telescope } from "lucide-react";
import { useState } from "react";
import type { Future } from "../lib/journey";
import { FUTURE_TRAIT_META } from "./Icons";

export const hasFuture = (f: Future) => Boolean(f.statement) || f.traits.length > 0;

/** "By age 33" when the age is known, otherwise "In 5 years". */
export function futureWhen(f: Future, age: number | null) {
  if (!f.years) return "Future you";
  return age !== null ? `By age ${age + f.years}` : `In ${f.years} ${f.years === 1 ? "year" : "years"}`;
}

export function TraitPills({ traits }: { traits: FutureTrait[] }) {
  if (!traits.length) return null;
  return (
    <span className="future-traits">
      {traits.map((t) => {
        const { label, icon: Icon } = FUTURE_TRAIT_META[t];
        return (
          <span key={t} className="future-trait">
            <Icon size={13} aria-hidden="true" />
            {label}
          </span>
        );
      })}
    </span>
  );
}

/** Dashboard header line: who you're becoming. */
export function FutureChip({ future, age }: { future: Future; age: number | null }) {
  if (!hasFuture(future))
    return (
      <a className="future-chip empty" href="#/plan">
        <Telescope size={16} aria-hidden="true" />
        Who do you want to become? <span className="future-chip-cta">Add it</span>
      </a>
    );
  return (
    <p className="future-chip">
      <Telescope size={16} className="main-goal-icon" aria-hidden="true" />
      <span className="muted">{futureWhen(future, age)}:</span>
      <strong>{future.statement ? `someone who ${future.statement}` : future.traits.map((t) => FUTURE_TRAIT_META[t].label).join(", ")}</strong>
      <a className="main-goal-edit" href="#/plan" aria-label="Edit future you" title="Edit future you">
        <PenLine size={14} aria-hidden="true" />
      </a>
    </p>
  );
}

/** Plan page: view and edit "Future you". */
export function FutureSection({ future, age, onSave }: { future: Future; age: number | null; onSave: (f: Future) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing)
    return (
      <FutureEditor
        initial={future}
        age={age}
        onCancel={() => setEditing(false)}
        onSave={(f) => {
          onSave(f);
          setEditing(false);
        }}
      />
    );

  if (!hasFuture(future))
    return (
      <button type="button" className="add-row future-add" onClick={() => setEditing(true)}>
        <Plus size={18} aria-hidden="true" />
        Describe who you want to become
      </button>
    );

  return (
    <div className="item plan-row future-row">
      <div className="plan-row-main">
        <span className="habit-icon" aria-hidden="true">
          <Telescope size={18} />
        </span>
        <div className="future-text">
          <small className="muted">{futureWhen(future, age)}</small>
          {future.statement && <strong>Someone who {future.statement}</strong>}
          <TraitPills traits={future.traits} />
        </div>
        <button type="button" className="plan-icon-btn" onClick={() => setEditing(true)} aria-label="Edit future you" title="Edit">
          <PenLine size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function FutureEditor({
  initial,
  age,
  onSave,
  onCancel,
}: {
  initial: Future;
  age: number | null;
  onSave: (f: Future) => void;
  onCancel: () => void;
}) {
  const [statement, setStatement] = useState(initial.statement ?? "");
  const [years, setYears] = useState<number>(initial.years ?? 5);
  const [traits, setTraits] = useState<FutureTrait[]>(initial.traits);
  const text = statement.trim();
  const empty = !text && !traits.length;
  const toggle = (t: FutureTrait) => setTraits((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(-MAX_FUTURE_TRAITS)));

  return (
    <form
      className="future-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(empty ? { statement: null, years: null, traits: [] } : { statement: text || null, years, traits });
      }}
    >
      <div className="ob-try" role="radiogroup" aria-label="Years ahead">
        {FUTURE_YEARS.map((y) => (
          <button key={y} type="button" role="radio" aria-checked={years === y} className={`ob-try-chip ${years === y ? "on" : ""}`} onClick={() => setYears(y)}>
            {y} {y === 1 ? "year" : "years"}
            {age !== null && <span className="muted"> · age {age + y}</span>}
          </button>
        ))}
      </div>
      <label className="ob-label" htmlFor="future-statement">
        In {years} {years === 1 ? "year" : "years"}, I am someone who…
      </label>
      <input
        id="future-statement"
        className="ob-input wide"
        autoFocus
        maxLength={MAX_FUTURE_STATEMENT}
        placeholder="e.g. trains 4 times a week and works as a data analyst"
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <div className="ob-chips" aria-label={`Traits, up to ${MAX_FUTURE_TRAITS}`}>
        {FUTURE_TRAITS.map((t) => {
          const { label, icon: Icon } = FUTURE_TRAIT_META[t];
          const on = traits.includes(t);
          return (
            <button key={t} type="button" className={`ob-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(t)}>
              <Icon size={16} aria-hidden="true" />
              {label}
              {on && <Check className="ob-chip-check" size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="future-editor-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary-btn">
          {empty && hasFuture(initial) ? "Clear" : "Save"}
        </button>
      </div>
    </form>
  );
}
