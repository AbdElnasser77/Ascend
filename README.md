# Ascend

Personal productivity SaaS.

## Structure

```
apps/
  api/      Express + TypeScript (port 4000)
  web/      React + Vite + TypeScript (port 5173, proxies /api -> 4000)
packages/
  shared/   Types & logic shared by api, web (and mobile later)
```

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in DATABASE_URL and the two JWT secrets
npm run dev                              # the API applies database migrations on start
```

Run migrations without starting the server: `npm run db:migrate -w @ascend/api`.

## Auth

JWT, handled by `apps/api/src/routes/auth.ts`:

- `POST /api/auth/register`, `POST /api/auth/login` return a 15-minute **access token** (sent as
  `Authorization: Bearer …`) and set a 30-day **refresh token** in an httpOnly cookie scoped to `/api/auth`.
- `POST /api/auth/refresh` rotates the refresh token. Reusing an old one (outside a 30s grace window for
  parallel tabs) revokes every session of that user.
- `POST /api/auth/logout` revokes the refresh token. `GET /api/auth/me` returns the user.
- `POST /api/auth/forgot` emails a one-time reset link (30 minutes); `POST /api/auth/reset` sets the new password,
  signs out every other session and signs in. Without `RESEND_API_KEY` the email is printed to the API console.
- Password rules (8+ characters, a letter, a number, not your email) live in `@ascend/shared`, so the sign-up
  form's checklist and the API enforce exactly the same thing.
- Sign-in, sign-up and reset are rate limited per IP (and per email for sign-in and reset requests).

The web app keeps the access token in memory only and stores nothing in localStorage.

## Data

Postgres is the only copy of a user's journey. Schema and migrations: `apps/api/src/db/migrate.ts`.

| Table | Holds |
| --- | --- |
| `users` | account, birthday, `journey_start` (Day 1), `start_slots`, "Future you" (`future_self`, `future_years`, `future_traits`) |
| `password_resets` | hashed one-time reset tokens |
| `habits` | name, icon, `created_on`, `archived_on` (removed habits keep their history) |
| `habit_checks` | a habit checked off on a day |
| `habit_redeems` | Second Chance: a missed day repaired later |
| `tasks` | title, day, done |
| `goals` | title, kind, `main`, `achieved_on` |
| `refresh_tokens` | hashed refresh token ids, for rotation and revocation |

Endpoints (all need the access token; `apps/api/src/routes/journey.ts`):

```
GET    /api/journey                      everything the app shows
POST   /api/journey/start                onboarding: birthday, first goal, 1–2 habits
PATCH  /api/profile                      birthday and/or "Future you"
POST   /api/habits                       PATCH|DELETE /api/habits/:id
PUT    /api/habits/:id/checks/:day       DELETE to uncheck (today only)
POST   /api/habits/:id/redeems           Second Chance
POST   /api/tasks                        PATCH|DELETE /api/tasks/:id   (Level 10+)
POST   /api/goals                        PATCH|DELETE /api/goals/:id   (main goal any time, more at Level 20)
```

The API replays each journey through `@ascend/shared`'s progression engine, so level limits (habit slots,
tasks, goals, Second Chances) are enforced on the server, not just hidden in the UI. Days are the user's local
calendar days: the web sends `X-Local-Date`, and the API only accepts a date that is "today" somewhere on Earth.
