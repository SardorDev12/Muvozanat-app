# Muvozanat

A life-balance app: rate eight areas of your life on a wheel, see where the
wheel is flat, and turn the flat parts into goals you actually work on.

One codebase — React Native + Expo Router — ships to **iOS, Android and the
web**. Supabase holds the data and the auth. A Cloudflare Worker handles the
one job that has to run when nobody has the app open: reminding you to
reassess.

---

## How the app works

**Today** — the default screen. Long-term goals sit in a compact strip under the
date header (each with a progress ring and its life-area colour), then today's
tasks, then a collapsed _Missed_ toggle, then _Completed_.

**My Life** — the wheel. Eight sectors animate outward in sequence while a
needle sweeps once around the eight directions. Below it, a pie chart of how
your attention is distributed, a per-area breakdown with change-since-last
markers, and a trend chart across every assessment you've taken.

**Assessment** — the wheel, the pie, and eight 1–10 inputs. Every mark carries a
written definition, so a 4 in _Money_ means something specific rather than a
vibe. Saving shows which areas scored lowest and sends you to set goals against
them.

**Goals** — hierarchical and flexible. A goal belongs to one life area; it
breaks into _components_ (milestones); tasks hang off a component, directly off
a goal, or off nothing at all. Tasks repeat with a Google Tasks-style rule —
daily, weekly on chosen days, monthly on a date or an _nth weekday_, yearly,
every N units, ending never / on a date / after N occurrences.

Completion **rolls upward**: finish every task in a component and the component
closes itself; close every component (and every task hanging straight off the
goal) and the goal closes itself. Because of that, ticking a repeating task has
to be unambiguous — so the app asks whether you mean _done for today_ or _task
fully complete_. Only the second retires the task and counts towards its
component. One-off tasks skip the question; there is only one thing they can
mean.

---

## Stack

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------- |
| App              | Expo SDK 57, Expo Router, React Native 0.86, react-native-web |
| Animation        | Reanimated 4 + react-native-svg                               |
| Data             | Supabase (Postgres + Auth + RLS)                              |
| Server-side jobs | Cloudflare Workers (cron)                                     |
| State            | TanStack Query                                                |
| i18n             | i18next — Uzbek, Russian, English                             |

**Cloudflare's role is deliberately small.** All ordinary reads and writes go
straight from the app to Supabase under Row Level Security. The Worker exists
because a reassessment reminder has to fire on a schedule whether or not the app
is open — that's the one job needing the service role key.

---

## Repository layout

```
app/                      Expo Router routes (file-based)
  (auth)/                 sign-in, sign-up, forgot-password
  (app)/                  the tab bar: today, my-life, goals, settings
  assessment/             the wheel flow and its results screen
  auth/callback.tsx       OAuth and email-link landing
src/
  components/             LifeWheel, LifePieChart, ScoreInput, pickers, ui/
  features/
    assessment/           the eight areas, score bands, queries
    auth/                 AuthProvider, Google OAuth
    goals/                goal + component queries
    tasks/                recurrence engine, Today-list composition, queries
    profile/              profile and notification queries
  i18n/locales/           en.ts (source of truth), ru.ts, uz.ts
  theme/                  light/dark tokens
  utils/date.ts           calendar-day helpers
supabase/migrations/      schema, functions/triggers, RLS
workers/reminders/        the Cloudflare cron worker
.github/workflows/        CI, EAS preview builds, OTA updates, deploys
```

---

## Three design decisions worth knowing

**Recurring tasks are a single row.** A task that repeats every weekday forever
is one row with a recurrence rule, not 250 rows a year. Occurrences are expanded
in TypeScript (`src/features/tasks/recurrence.ts`) for whatever window the
screen needs — one day for Today, the missed-lookback window for the missed
list. Only _deviations_ get stored: the absence of a `task_completions` row is
the canonical "not done yet", which is also what makes un-completing a task a
delete rather than a state flag.

**Completion rolls up in Postgres, not in the app.** Triggers recompute a
component's status from its tasks, and a goal's from its components plus its
direct tasks, writing only on an actual change so the two triggers cannot
ping-pong. Keeping it in the database means the invariant holds whichever client
wrote last, and the rule lives in one place instead of in every screen that can
complete something. A component or goal with no children keeps whatever status
you set by hand.

**Dates are calendar days, not instants.** A task due "today" is due on _your_
local today. Everything crossing the API boundary is a `YYYY-MM-DD` string and
every `Date` is at local midnight. `daysBetween` normalises through UTC so a
daylight-saving transition can't produce a 23-hour day and round the wrong way.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env      # then fill in the Supabase values
```

### 2. Supabase

Create a project, then apply the migrations:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or run the three files in `supabase/migrations/` in the SQL editor, in
filename order.

Copy the project URL and **anon** key into `.env`. The anon key is safe to ship
— it is inlined into the JS bundle and RLS is what actually protects the data.
The service role key must never appear in `.env` or anywhere in this app.

**Google sign-in.** In Google Cloud Console create an OAuth client and add
`https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
URI. Paste the client id and secret into Supabase → Authentication → Providers →
Google. Then in Supabase → Authentication → URL Configuration add these
redirect URLs:

```
muvozanat://auth/callback
http://localhost:8081/auth/callback
https://<your-web-domain>/auth/callback
```

### 3. Run it

```bash
npm run web        # browser
npm run ios        # iOS simulator (macOS)
npm run android    # Android emulator
```

> Expo Go works for most of the app. Once you add native modules beyond what
> Expo Go bundles, build a development client: `eas build --profile development`.

### 4. The reminder worker

```bash
cd workers/reminders
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_TRIGGER_SECRET    # optional, enables POST /run
```

Set `SUPABASE_URL` in `wrangler.toml`, then `npm run deploy`. It runs daily at
06:00 UTC and is idempotent — it skips anyone who already has an open nudge, so
a missed or duplicated run is harmless.

---

## EAS: preview builds and OTA updates

```bash
npm install -g eas-cli
eas login
eas init                  # writes extra.eas.projectId into app.json
eas update:configure      # writes the updates URL into app.json
```

Commit the `app.json` changes those two commands make — CI needs them.

Add these repository secrets in GitHub → Settings → Secrets and variables →
Actions:

| Secret                          | Used by                        |
| ------------------------------- | ------------------------------ |
| `EXPO_TOKEN`                    | EAS build and update workflows |
| `EXPO_PUBLIC_SUPABASE_URL`      | every build                    |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | every build                    |
| `CLOUDFLARE_API_TOKEN`          | web and worker deploys         |
| `CLOUDFLARE_ACCOUNT_ID`         | web and worker deploys         |

### What runs when

| Workflow            | Trigger                                                          | Does                                                                               |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ci.yml`            | every PR, push to `dev`/`main`                                   | lint, typecheck, unit tests, web export smoke test, worker typecheck               |
| `eas-preview.yml`   | PR labelled `build-preview`, or manual                           | publishes an OTA update to a `pr-<number>` branch and starts native preview builds |
| `eas-update.yml`    | push to `dev` → `preview` channel; push to `main` → `production` | re-runs the checks, then publishes the OTA update                                  |
| `deploy-web.yml`    | push to `dev`/`main`                                             | exports the static web build and deploys to Cloudflare Pages                       |
| `deploy-worker.yml` | push to `main` touching `workers/**`                             | deploys the reminder worker                                                        |

Preview builds are gated behind a **`build-preview`** label so an ordinary PR
does not burn an EAS build slot. Add the label to a PR to get one.

OTA updates reach users without review, so `eas-update.yml` re-runs lint,
typecheck and tests before publishing rather than trusting the PR that merged.

---

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

`npm test` compiles the pure-logic modules with `tsconfig.test.json` and runs
them under `node --test`. The recurrence rules and the Today/missed/completed
composition are covered there — including leap days, month-end clamping,
partial first weeks, and the missed-lookback bound.

---

## Adding a language

1. Copy `src/i18n/locales/en.ts` and translate it.
2. Add it to `resources` and `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`.
3. Add the code to the `locale` check constraint in the profiles migration.

`en.ts` defines the `Translations` type, so a missing key is a typecheck
failure rather than a blank string at runtime.
