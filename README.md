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

Everything here is done in a browser — Supabase, Cloudflare, Google Cloud,
Expo and GitHub dashboards. No command line, no local install: the workflows in
this repo do every build and deploy.

**Already wired up in the repo, nothing to do:** the EAS project id, owner and
update URL in `app.json`; the SQL migrations; all five workflows; the Cloudflare
Pages SPA fallback; and the worker's Supabase URL, which is injected at deploy
time from your GitHub secret rather than committed.

Work through the steps in order — each one produces a value the next needs.

### 1. Supabase — database and keys

1. **Create the project.** [supabase.com/dashboard](https://supabase.com/dashboard)
   → **New project**. Pick a region near your users and save the database
   password somewhere safe.

2. **Create the schema.** **SQL Editor → New query**, then paste and run the
   files from `supabase/migrations/` **in filename order**:

   | #   | File                                   | What it creates                          |
   | --- | -------------------------------------- | ---------------------------------------- |
   | 1   | `20260914000100_init.sql`              | enums, tables, indexes                   |
   | 2   | `20260914000200_functions.sql`         | triggers, views, `save_assessment`       |
   | 3   | `20260914000300_rls.sql`               | Row Level Security policies and grants   |
   | 4   | `20260914000400_completion_rollup.sql` | `completed_at` and the completion rollup |

   The editor runs a script as one transaction, so you can also paste all four
   into a single query and run them together. Either way it should finish with
   "Success. No rows returned."

   Row Level Security is switched on by file 3. There is nothing to enable when
   creating the project.

   Check it worked:

   ```sql
   select count(*) as tables from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE';   -- 8
   select count(*) as policies from pg_policies where schemaname = 'public';  -- 28
   ```

3. **Copy the keys.** **Project Settings → API**. Take the **Project URL** and
   the **anon / public** key — they become GitHub secrets in step 5.

   The **service_role** key is on the same page. It bypasses Row Level
   Security. It goes into the Cloudflare Worker in step 7 and **nowhere else** —
   never a GitHub secret used by an app build, never anything prefixed
   `EXPO_PUBLIC_`, because those are compiled into the JS bundle and readable by
   anyone who opens the site.

   A local `.env` is only needed if you run the app on your own machine. If you
   build through GitHub Actions, skip it.

### 2. Cloudflare — account, token, Pages project

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**.
   Your **Account ID** is in the right-hand sidebar.

2. **My Profile → API Tokens → Create Token → Custom token**, with:
   - _Account → Workers Scripts → Edit_
   - _Account → Cloudflare Pages → Edit_

The Pages project itself is created automatically by the deploy workflow on its
first run, so there is nothing to set up by hand.

Your web address will be **`https://muvozanat.pages.dev`**. Step 4 needs it.

### 3. Google Cloud — the sign-in client

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project.
2. **APIs & Services → OAuth consent screen → External** → app name, support
   email, developer contact.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Web application**.
4. Under **Authorised redirect URIs** add exactly:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

5. Copy the **client ID** and **client secret**.

> Only the _Web_ client is needed. Sign-in runs through Supabase's OAuth
> endpoint in a system browser on phones too, so there is no separate iOS or
> Android Google client to create.

### 4. Supabase — providers and redirect URLs

1. **Authentication → Sign In / Providers → Google**: enable, paste the client
   id and secret from step 3, save.
2. **Email** is on by default. While testing, turning **Confirm email** off
   lets you sign up without checking your inbox.
3. **Authentication → URL Configuration**:
   - **Site URL**: `https://muvozanat.pages.dev`
   - **Redirect URLs** — add both:

     ```
     https://muvozanat.pages.dev/auth/callback
     muvozanat://auth/callback
     ```

   The `muvozanat://` line is what lets the phone apps receive the callback.
   Without it, Google sign-in works on the web and hangs on a device with no
   error.

### 5. Expo and GitHub — the token and the secrets

1. [expo.dev](https://expo.dev) → **Account settings → Access tokens → Create
   token.** Copy it.

   The project itself is already created and referenced in `app.json`
   (`muvozanat`, owner `sardordev12`), so there is nothing else to do here.

2. **GitHub → Settings → Secrets and variables → Actions → New repository
   secret**, five times. Paste the **value only** — name and value are separate
   boxes, so no `KEY=value`, no quotes:

   | Secret                          | Value                            |
   | ------------------------------- | -------------------------------- |
   | `EXPO_PUBLIC_SUPABASE_URL`      | Supabase Project URL (step 1.3)  |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** key (step 1.3) |
   | `EXPO_TOKEN`                    | Expo access token (step 5.1)     |
   | `CLOUDFLARE_API_TOKEN`          | Cloudflare token (step 2.2)      |
   | `CLOUDFLARE_ACCOUNT_ID`         | Cloudflare account id (step 2.1) |

   Every deploy workflow checks these first and fails with the missing name if
   one is absent, so a typo says so plainly rather than surfacing as an
   authentication error further down.

### 6. First deploy

Push anything to `main`, or **Actions → Deploy web → Run workflow**. Three
workflows run: **CI**, **Deploy web**, and **EAS OTA update**. All three should
go green.

Open `https://muvozanat.pages.dev`. You should get the sign-in screen. Create an
account, and the app should send you straight into the life wheel assessment.

If sign-in with Google returns to a blank page, the redirect URL in step 4.3
does not match your actual domain.

### 7. The reminder worker

The worker has to exist before it can be given a secret, and CI creates it on
its first deploy.

1. **Actions → Deploy reminder worker → Run workflow.**
2. **Workers & Pages → muvozanat-reminders → Settings → Variables and Secrets →
   Add**, type **Secret**, name `SUPABASE_SERVICE_ROLE_KEY`, value from step
   1.3.
3. Optionally add `ADMIN_TRIGGER_SECRET` the same way. It enables `POST /run`,
   so you can trigger a sweep by hand instead of waiting for 06:00 UTC.
4. Re-run the workflow so the worker picks the secret up.

Secrets set in the dashboard survive later deploys, so this is a one-off.
`SUPABASE_URL` is injected automatically from your GitHub secret — there is no
placeholder to edit.

### 8. Getting it on a phone

**Actions → EAS native build → Run workflow**, pick a platform and the
`preview` profile. It takes 10–20 minutes; the result appears on
[expo.dev](https://expo.dev) with a QR code and an install link. Android gives
you an APK you can install directly. iOS needs the device registered to your
Apple Developer account, which Expo walks you through the first time.

After that, **JS-only changes need no rebuild**: every push to `main` publishes
an over-the-air update and the installed app picks it up on its next launch.
Build again only when you add a native library or change `app.json`.

<details>
<summary>Prefer the command line?</summary>

```bash
npm install -g eas-cli supabase
supabase link --project-ref <ref> && supabase db push
cd workers/reminders && npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

`eas init` and `eas update:configure` are not needed — `app.json` already has
the project id, owner and update URL.

</details>

---

## What CI runs, and when

There is one branch, `main`. Every push to it deploys.

| Workflow            | Trigger                              | Does                                                                                                       |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ci.yml`            | push to `main`                       | lint, typecheck, unit tests, schema tests against a real Postgres, web export smoke test, worker typecheck |
| `deploy-web.yml`    | push to `main`                       | exports the web build and deploys it to Cloudflare Pages                                                   |
| `eas-update.yml`    | push to `main`                       | re-runs the checks, then publishes an over-the-air update to the `production` channel                      |
| `deploy-worker.yml` | push to `main` touching `workers/**` | deploys the reminder worker                                                                                |
| `eas-preview.yml`   | **manual only**                      | builds an installable Android / iOS app                                                                    |

**Native builds are deliberately not automatic.** They take 10-20 minutes and
use EAS build credits, and almost every change reaches an installed app as an
over-the-air update instead. Run one from **Actions → EAS native build → Run
workflow** when you actually need a new installable app: after adding a native
library, changing `app.json`, or setting up a new device.

Builds from the `preview` profile sit on the `production` channel on purpose.
An app you sideload for testing has to listen to the same channel the pushes
publish to, or it would never receive an update.

OTA updates reach installed apps with no review step, so `eas-update.yml`
re-runs lint, typecheck and tests before publishing.

---

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

```bash
npm run test:schema
```

`npm test` compiles the pure-logic modules with `tsconfig.test.json` and runs
them under `node --test`. The recurrence rules and the Today/missed/completed
composition are covered there — including leap days, month-end clamping,
partial first weeks, and the missed-lookback bound.

`npm run test:schema` applies every migration to a throwaway Postgres and
asserts the things a typecheck cannot see: that the profile trigger fires on a
new user, that completion rolls from tasks through components to goals and back
when reopened, that a paused goal survives the rollup, and that Row Level
Security actually stops one user reading another's data. It needs a local
Postgres, or `DATABASE_URL` pointing at one — CI runs it against a `postgres:16`
service on every pull request.

---

## Adding a language

1. Copy `src/i18n/locales/en.ts` and translate it.
2. Add it to `resources` and `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`.
3. Add the code to the `locale` check constraint in the profiles migration.

`en.ts` defines the `Translations` type, so a missing key is a typecheck
failure rather than a blank string at runtime.
