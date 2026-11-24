import { FUTURE_TRAITS, FUTURE_YEARS, MAX_FUTURE_STATEMENT, MAX_FUTURE_TRAITS } from "@ascend/shared";
import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { pool, tx } from "../db/pool.js";
import { HttpError, clientId, date, localToday, param, text } from "../http.js";
import { evaluate, isActiveOn, loadJourney } from "../journey/data.js";

const GOAL_KINDS = ["course", "streak", "position", "milestone"];
const ICON_RE = /^[a-z0-9-]{1,24}$/;
/** a journey starts with one habit; more slots come with levels */
const MAX_START_HABITS = 1;

const icon = (v: unknown) => {
  if (typeof v !== "string" || !ICON_RE.test(v)) throw new HttpError(400, "Unknown icon", "icon");
  return v;
};
const goalKind = (v: unknown) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !GOAL_KINDS.includes(v)) throw new HttpError(400, "Unknown goal kind", "kind");
  return v;
};
/** Builds `col = $n` assignments after the given leading parameters. */
function updates(leading: unknown[]) {
  const sets: string[] = [];
  const values = [...leading];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  return { sets, values, set };
}

/** "Future you": every part is optional; an empty statement is stored as none. */
function future(v: unknown) {
  const o = (v ?? {}) as Record<string, unknown>;
  const statement = typeof o.statement === "string" ? o.statement.trim() : "";
  if (statement.length > MAX_FUTURE_STATEMENT) throw new HttpError(400, `Keep it under ${MAX_FUTURE_STATEMENT} characters`, "future");
  const years = o.years === null || o.years === undefined ? null : Number(o.years);
  if (years !== null && !(FUTURE_YEARS as readonly number[]).includes(years)) throw new HttpError(400, "Pick how many years ahead", "future");
  const traits = Array.isArray(o.traits) ? [...new Set(o.traits)] : [];
  if (traits.length > MAX_FUTURE_TRAITS || !traits.every((t) => (FUTURE_TRAITS as readonly unknown[]).includes(t))) {
    throw new HttpError(400, `Pick up to ${MAX_FUTURE_TRAITS} traits`, "future");
  }
  return { statement: statement || null, years, traits: traits as string[] };
}

const unique = (err: unknown) => (err as { code?: string }).code === "23505";

export const journeyRouter = Router();
journeyRouter.use(requireAuth);

// ---------- the whole journey ----------

journeyRouter.get("/journey", async (req, res) => {
  res.json(await loadJourney(req.user!.sub));
});

/** Onboarding: birthday, the first goal and the starting habits. Day 1 is today or tomorrow. */
journeyRouter.post("/journey/start", async (req, res) => {
  const userId = req.user!.sub;
  const today = localToday(req);
  const birthday = date(req.body?.birthday, "birthday");
  if (birthday > today) throw new HttpError(400, "Your birthday can't be in the future", "birthday");
  const goal = req.body?.goal ?? {};
  const goalTitle = text(goal.title, "Goal", 3, 120);
  const kind = goalKind(goal.kind);
  const habits: unknown[] = Array.isArray(req.body?.habits) ? req.body.habits : [];
  if (habits.length !== MAX_START_HABITS) throw new HttpError(400, "Choose one habit to start with", "habits");
  const fut = future(req.body?.future);
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
  const startsOn = req.body?.startsOn === undefined ? today : date(req.body.startsOn, "startsOn");
  if (startsOn !== today && startsOn !== tomorrow) throw new HttpError(400, "Day 1 can be today or tomorrow", "startsOn");
  const picked = habits.map((h) => {
    const o = (h ?? {}) as Record<string, unknown>;
    return { id: clientId(o.id), name: text(o.name, "Habit", 1, 60), icon: icon(o.icon) };
  });

  await tx(async (db) => {
    const started = await db.query(
      `UPDATE users SET birthday = $2, journey_start = $3, start_slots = $4, future_self = $5, future_years = $6, future_traits = $7
       WHERE id = $1 AND journey_start IS NULL RETURNING id`,
      [userId, birthday, startsOn, picked.length, fut.statement, fut.years, fut.traits],
    );
    if (!started.rowCount) throw new HttpError(409, "Your journey has already started");
    for (const h of picked) {
      await db.query(`INSERT INTO habits (id, user_id, name, icon, created_on) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)`, [
        h.id,
        userId,
        h.name,
        h.icon,
        startsOn,
      ]);
    }
    await db.query(`DELETE FROM goals WHERE user_id = $1 AND main AND achieved_on IS NULL`, [userId]);
    await db.query(
      `INSERT INTO goals (id, user_id, title, kind, main, created_on) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, true, $5)`,
      [clientId(goal.id), userId, goalTitle, kind, startsOn],
    );
  });
  res.status(201).json(await loadJourney(userId));
});

/** A journey set to start tomorrow starts today instead; everything set up for Day 1 moves with it. */
journeyRouter.post("/journey/start-today", async (req, res) => {
  const userId = req.user!.sub;
  const today = localToday(req);
  await tx(async (db) => {
    const { rows } = await db.query<{ start: string }>(
      `SELECT journey_start AS start FROM users WHERE id = $1 AND journey_start > $2 FOR UPDATE`,
      [userId, today],
    );
    const start = rows[0]?.start;
    if (!start) throw new HttpError(409, "Your journey has already started");
    await db.query(`UPDATE users SET journey_start = $2 WHERE id = $1`, [userId, today]);
    await db.query(`UPDATE habits SET created_on = $3 WHERE user_id = $1 AND created_on = $2`, [userId, start, today]);
    await db.query(`UPDATE goals SET created_on = $3 WHERE user_id = $1 AND created_on = $2`, [userId, start, today]);
  });
  res.json(await loadJourney(userId));
});

/** Birthday and/or "Future you". */
journeyRouter.patch("/profile", async (req, res) => {
  const { sets, values, set } = updates([req.user!.sub]);
  if (req.body?.birthday !== undefined) {
    const birthday = date(req.body.birthday, "birthday");
    if (birthday > localToday(req)) throw new HttpError(400, "Your birthday can't be in the future", "birthday");
    set("birthday", birthday);
  }
  if (req.body?.future !== undefined) {
    const fut = future(req.body.future);
    set("future_self", fut.statement);
    set("future_years", fut.years);
    set("future_traits", fut.traits);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1`, values);
  res.json((await loadJourney(req.user!.sub)).profile);
});

// ---------- habits ----------

journeyRouter.post("/habits", async (req, res) => {
  const userId = req.user!.sub;
  const { journey, today, habitSlots } = await evaluate(userId, localToday(req));
  const name = text(req.body?.name, "Habit", 1, 60);
  const active = journey.habits.filter((h) => isActiveOn(h, today)).length;
  if (active >= habitSlots) throw new HttpError(403, "All your habit slots are in use. Level up to unlock another.");
  try {
    const { rows } = await pool.query(
      `INSERT INTO habits (id, user_id, name, icon, created_on) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)
       RETURNING id`,
      [clientId(req.body?.id), userId, name, icon(req.body?.icon), today],
    );
    res.status(201).json({ id: rows[0].id, name, icon: req.body.icon, createdAt: today });
  } catch (err) {
    if (unique(err)) throw new HttpError(409, "That habit already exists");
    throw err;
  }
});

journeyRouter.patch("/habits/:id", async (req, res) => {
  const { sets, values, set } = updates([param(req, "id"), req.user!.sub]);
  if (req.body?.name !== undefined) set("name", text(req.body.name, "Habit", 1, 60));
  if (req.body?.icon !== undefined) set("icon", icon(req.body.icon));
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  const { rowCount } = await pool.query(`UPDATE habits SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2`, values);
  if (!rowCount) throw new HttpError(404, "Habit not found");
  res.status(204).end();
});

/** Removing keeps the habit's history (it stops counting from today); one added today disappears entirely. */
journeyRouter.delete("/habits/:id", async (req, res) => {
  const id = param(req, "id");
  const userId = req.user!.sub;
  const today = localToday(req);
  const gone = await pool.query(`DELETE FROM habits WHERE id = $1 AND user_id = $2 AND created_on >= $3`, [id, userId, today]);
  if (!gone.rowCount) {
    const archived = await pool.query(`UPDATE habits SET archived_on = $3 WHERE id = $1 AND user_id = $2 AND archived_on IS NULL`, [
      id,
      userId,
      today,
    ]);
    if (!archived.rowCount) throw new HttpError(404, "Habit not found");
  }
  res.status(204).end();
});

/** Check a habit off. Only today can be checked; missed days are repaired with Second Chance. */
journeyRouter.put("/habits/:id/checks/:day", async (req, res) => {
  const id = param(req, "id");
  const day = date(req.params.day, "day");
  const { journey, today } = await evaluate(req.user!.sub, localToday(req));
  if (day !== today) throw new HttpError(400, "Habits can only be checked off today");
  const habit = journey.habits.find((h) => h.id === id);
  if (!habit || !isActiveOn(habit, today)) throw new HttpError(404, "Habit not found");
  await pool.query(`INSERT INTO habit_checks (habit_id, user_id, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [id, req.user!.sub, day]);
  res.status(204).end();
});

journeyRouter.delete("/habits/:id/checks/:day", async (req, res) => {
  const day = date(req.params.day, "day");
  if (day !== localToday(req)) throw new HttpError(400, "Only today's check can be undone");
  await pool.query(`DELETE FROM habit_checks WHERE habit_id = $1 AND user_id = $2 AND day = $3`, [param(req, "id"), req.user!.sub, day]);
  res.status(204).end();
});

/** Second Chance: repair a missed day by doing the habit twice today. Limited per month by level. */
journeyRouter.post("/habits/:id/redeems", async (req, res) => {
  const id = param(req, "id");
  const day = date(req.body?.day, "day");
  const userId = req.user!.sub;
  const { journey, start, today, state } = await evaluate(userId, localToday(req));
  const habit = journey.habits.find((h) => h.id === id);
  if (!habit) throw new HttpError(404, "Habit not found");
  if (day < start || day >= today) throw new HttpError(400, "Only a missed day before today can be repaired");
  if (!isActiveOn(habit, day)) throw new HttpError(400, "That habit wasn't active on that day");
  if (journey.habitLog[day]?.includes(id)) throw new HttpError(409, "That day is already done");
  if (state.secondChancesLeft < 1) throw new HttpError(403, "No Second Chances left this month");
  try {
    await pool.query(`INSERT INTO habit_redeems (habit_id, user_id, day, redeemed_on) VALUES ($1, $2, $3, $4)`, [id, userId, day, today]);
  } catch (err) {
    if (unique(err)) throw new HttpError(409, "That day is already repaired");
    throw err;
  }
  res.status(201).json({ habitId: id, day, on: today });
});

// ---------- tasks (Level 10) ----------

journeyRouter.post("/tasks", async (req, res) => {
  const userId = req.user!.sub;
  const { today, state } = await evaluate(userId, localToday(req));
  if (!state.unlocks.tasks) throw new HttpError(403, "Tasks unlock at Level 10");
  const title = text(req.body?.title, "Task", 1, 120);
  const day = date(req.body?.date, "date");
  if (day < today) throw new HttpError(400, "Tasks can't be added to past days", "date");
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (id, user_id, title, day) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4) RETURNING id`,
      [clientId(req.body?.id), userId, title, day],
    );
    res.status(201).json({ id: rows[0].id, title, date: day, done: false });
  } catch (err) {
    if (unique(err)) throw new HttpError(409, "That task already exists");
    throw err;
  }
});

/** Rename (today or later) or tick off (today only). Past days stay as they were. */
journeyRouter.patch("/tasks/:id", async (req, res) => {
  const id = param(req, "id");
  const userId = req.user!.sub;
  const today = localToday(req);
  const { rows } = await pool.query<{ day: string }>(`SELECT day FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId]);
  const task = rows[0];
  if (!task) throw new HttpError(404, "Task not found");
  if (task.day < today) throw new HttpError(400, "Past days can't be changed");

  const { sets, values, set } = updates([id, userId]);
  if (req.body?.title !== undefined) set("title", text(req.body.title, "Task", 1, 120));
  if (req.body?.done !== undefined) {
    if (typeof req.body.done !== "boolean") throw new HttpError(400, "done must be true or false", "done");
    if (task.day !== today) throw new HttpError(400, "Only today's tasks can be ticked off");
    set("done", req.body.done);
  }
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  await pool.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2`, values);
  res.status(204).end();
});

journeyRouter.delete("/tasks/:id", async (req, res) => {
  const { rowCount } = await pool.query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2 AND day >= $3`, [
    param(req, "id"),
    req.user!.sub,
    localToday(req),
  ]);
  if (!rowCount) throw new HttpError(404, "Task not found (past days can't be changed)");
  res.status(204).end();
});

// ---------- goals (your main goal any time; more from Level 20) ----------

journeyRouter.post("/goals", async (req, res) => {
  const userId = req.user!.sub;
  const { today, state } = await evaluate(userId, localToday(req));
  const main = req.body?.main === true;
  if (!main && !state.unlocks.goals) throw new HttpError(403, "More goals unlock at Level 20");
  const title = text(req.body?.title, "Goal", main ? 3 : 1, 120);
  const kind = goalKind(req.body?.kind);
  try {
    const { rows } = await pool.query(
      `INSERT INTO goals (id, user_id, title, kind, main, created_on) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6)
       RETURNING id`,
      [clientId(req.body?.id), userId, title, kind, main, today],
    );
    res.status(201).json({ id: rows[0].id, title, createdAt: today, ...(kind && { kind }), ...(main && { main }) });
  } catch (err) {
    if (unique(err)) throw new HttpError(409, main ? "You already have a main goal" : "That goal already exists");
    throw err;
  }
});

/** Rename, mark achieved (today), or undo an achievement made today. */
journeyRouter.patch("/goals/:id", async (req, res) => {
  const id = param(req, "id");
  const userId = req.user!.sub;
  const today = localToday(req);
  const { sets, values, set } = updates([id, userId]);
  if (req.body?.title !== undefined) set("title", text(req.body.title, "Goal", 1, 120));
  let guard = "";
  if (req.body?.achieved === true) {
    values.push(today);
    sets.push(`achieved_on = COALESCE(achieved_on, $${values.length})`);
  } else if (req.body?.achieved === false) {
    values.push(today);
    sets.push(`achieved_on = NULL`);
    guard = ` AND achieved_on = $${values.length}`; // only today's achievement can be undone
  }
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  try {
    const { rowCount } = await pool.query(`UPDATE goals SET ${sets.join(", ")} WHERE id = $1 AND user_id = $2${guard}`, values);
    if (!rowCount) throw new HttpError(404, guard ? "Only an achievement from today can be undone" : "Goal not found");
  } catch (err) {
    if (unique(err)) throw new HttpError(409, "You already have a main goal");
    throw err;
  }
  res.status(204).end();
});

journeyRouter.delete("/goals/:id", async (req, res) => {
  const { rowCount } = await pool.query(`DELETE FROM goals WHERE id = $1 AND user_id = $2`, [param(req, "id"), req.user!.sub]);
  if (!rowCount) throw new HttpError(404, "Goal not found");
  res.status(204).end();
});
