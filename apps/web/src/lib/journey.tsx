import type { FutureTrait } from "@ascend/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, api } from "./api";
import { todayISO } from "./dates";
import { HABIT_ICONS, newId, type Goal, type GoalKind, type Habit, type HabitLog, type Redeem, type Task } from "./progress";

/**
 * The signed-in user's journey. The database is the only copy:
 * it's loaded from the API, and every change is sent to the API.
 * Changes show instantly; if the server rejects one, the journey is reloaded from the server.
 */

/** "Future you": who the user wants to become, `years` from when they wrote it. All optional. */
export type Future = { statement: string | null; years: number | null; traits: FutureTrait[] };
export type Profile = { birthday: string | null; journeyStart: string | null; startSlots: number | null; future: Future };
export type JourneyData = {
  profile: Profile;
  habits: Habit[];
  habitLog: HabitLog;
  tasks: Task[];
  goals: Goal[];
  redeems: Redeem[];
};

export type StartInput = {
  birthday: string;
  /** Day 1: today or tomorrow */
  startsOn: string;
  future: Future;
  goal: { title: string; kind: GoalKind | null };
  habits: { name: string; icon: string }[];
};

type Ctx = { data: JourneyData; error: string | null; dismissError: () => void; actions: Actions };
const JourneyContext = createContext<Ctx | null>(null);

const json = (body: unknown) => ({ body: JSON.stringify(body) });

function buildActions(
  change: (local: (d: JourneyData) => JourneyData, remote: () => Promise<unknown>) => void,
  setData: (d: JourneyData) => void,
  get: () => JourneyData,
) {
  const today = () => todayISO();
  return {
    /**
     * Onboarding: saves it and resolves with the new journey (Day 1 is today).
     * It isn't applied until `replace` is called, so the caller can finish its animation first.
     */
    start(input: StartInput) {
      const body = {
        birthday: input.birthday,
        future: input.future,
        startsOn: input.startsOn,
        goal: { id: newId(), title: input.goal.title, kind: input.goal.kind },
        habits: input.habits.map((h) => ({ id: newId(), ...h })),
      };
      return api<JourneyData>("/journey/start", { method: "POST", ...json(body) });
    },
    replace: (d: JourneyData) => setData(d),

    /** A journey set to start tomorrow can start today instead. */
    async startToday() {
      setData(await api<JourneyData>("/journey/start-today", { method: "POST" }));
    },

    setBirthday: (birthday: string) =>
      change(
        (d) => ({ ...d, profile: { ...d.profile, birthday } }),
        () => api("/profile", { method: "PATCH", ...json({ birthday }) }),
      ),

    setFuture: (future: Future) =>
      change(
        (d) => ({ ...d, profile: { ...d.profile, future } }),
        () => api("/profile", { method: "PATCH", ...json({ future }) }),
      ),

    // ---- habits ----
    addHabit(name: string) {
      const id = newId();
      const icon = HABIT_ICONS[get().habits.length % HABIT_ICONS.length];
      // added before Day 1, a habit counts from Day 1 (same as the server)
      const start = get().profile.journeyStart;
      const createdAt = start && start > today() ? start : today();
      change(
        (d) => ({ ...d, habits: [...d.habits, { id, name, icon, createdAt }] }),
        () => api("/habits", { method: "POST", ...json({ id, name, icon }) }),
      );
    },
    updateHabit: (id: string, patch: { name?: string; icon?: string }) =>
      change(
        (d) => ({ ...d, habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }),
        () => api(`/habits/${id}`, { method: "PATCH", ...json(patch) }),
      ),
    /** keeps history; a habit added today disappears entirely */
    removeHabit: (id: string) =>
      change(
        (d) => ({
          ...d,
          habits: d.habits
            .map((h) => (h.id === id ? { ...h, archivedAt: today() } : h))
            .filter((h) => !h.archivedAt || h.archivedAt > h.createdAt),
        }),
        () => api(`/habits/${id}`, { method: "DELETE" }),
      ),
    toggleHabit(id: string) {
      const day = today();
      const checked = !(get().habitLog[day] ?? []).includes(id);
      change(
        (d) => {
          const ids = (d.habitLog[day] ?? []).filter((x) => x !== id);
          return { ...d, habitLog: { ...d.habitLog, [day]: checked ? [...ids, id] : ids } };
        },
        () => api(`/habits/${id}/checks/${day}`, { method: checked ? "PUT" : "DELETE" }),
      );
    },
    redeem: (habitId: string, day: string) =>
      change(
        (d) => ({ ...d, redeems: [...d.redeems, { habitId, day, on: today() }] }),
        () => api(`/habits/${habitId}/redeems`, { method: "POST", ...json({ day }) }),
      ),

    // ---- tasks ----
    addTask(title: string, date: string) {
      const id = newId();
      change(
        (d) => ({ ...d, tasks: [...d.tasks, { id, title, date, done: false }] }),
        () => api("/tasks", { method: "POST", ...json({ id, title, date }) }),
      );
    },
    renameTask: (id: string, title: string) =>
      change(
        (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, title } : t)) }),
        () => api(`/tasks/${id}`, { method: "PATCH", ...json({ title }) }),
      ),
    toggleTask(id: string) {
      const task = get().tasks.find((t) => t.id === id);
      if (!task || task.date !== today()) return;
      const done = !task.done;
      change(
        (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }),
        () => api(`/tasks/${id}`, { method: "PATCH", ...json({ done }) }),
      );
    },
    deleteTask: (id: string) =>
      change(
        (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id || t.date < today()) }),
        () => api(`/tasks/${id}`, { method: "DELETE" }),
      ),

    // ---- goals ----
    addGoal(title: string, opts: { main?: boolean; kind?: GoalKind } = {}) {
      const id = newId();
      change(
        (d) => ({ ...d, goals: [...d.goals, { id, title, createdAt: today(), ...opts }] }),
        () => api("/goals", { method: "POST", ...json({ id, title, ...opts }) }),
      );
    },
    renameGoal: (id: string, title: string) =>
      change(
        (d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, title } : g)) }),
        () => api(`/goals/${id}`, { method: "PATCH", ...json({ title }) }),
      ),
    achieveGoal: (id: string) =>
      change(
        (d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, achievedAt: g.achievedAt ?? today() } : g)) }),
        () => api(`/goals/${id}`, { method: "PATCH", ...json({ achieved: true }) }),
      ),
    undoGoal: (id: string) =>
      change(
        (d) => ({ ...d, goals: d.goals.map((g) => (g.id === id && g.achievedAt === today() ? { ...g, achievedAt: undefined } : g)) }),
        () => api(`/goals/${id}`, { method: "PATCH", ...json({ achieved: false }) }),
      ),
    deleteGoal: (id: string) =>
      change(
        (d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }),
        () => api(`/goals/${id}`, { method: "DELETE" }),
      ),
  };
}

export type Actions = ReturnType<typeof buildActions>;

/** Loads the journey, then renders children with it. */
export function JourneyProvider({ children, loading }: { children: ReactNode; loading: ReactNode }) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // requests run one at a time, in order, so quick taps (check, uncheck) reach the server in sequence
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef<JourneyData | null>(null);
  latest.current = data;

  const reload = useCallback(async () => {
    try {
      setData(await api<JourneyData>("/journey"));
      setFailed(false);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) setFailed(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const actions = useMemo(() => {
    const change = (local: (d: JourneyData) => JourneyData, remote: () => Promise<unknown>) => {
      setData((d) => (d ? local(d) : d));
      if (latest.current) latest.current = local(latest.current); // so a second tap before re-render sees this one
      queue.current = queue.current.then(() =>
        remote().catch((err) => {
          if (err instanceof ApiError && err.status === 401) return; // signed out; App handles it
          setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't save that change. Check your connection.");
          return reload(); // put the screen back in line with the server
        }),
      );
    };
    return buildActions(change, setData, () => latest.current!);
  }, [reload]);

  const dismissError = useCallback(() => setError(null), []);

  if (!data) {
    if (!failed) return <>{loading}</>;
    return (
      <div className="loader" role="alert">
        <p className="loader-title">Couldn't load your journey</p>
        <button type="button" className="ob-pill-btn wide" onClick={() => (setFailed(false), reload())}>
          Try again
        </button>
      </div>
    );
  }

  return <JourneyContext.Provider value={{ data, error, dismissError, actions }}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used inside <JourneyProvider>");
  return ctx;
}
