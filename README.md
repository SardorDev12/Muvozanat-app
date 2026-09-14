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

Everything below is done in a browser — Supabase, Google Cloud, Expo,
Cloudflare and GitHub dashboards. No CLI is required: the GitHub Actions in
this repo do the builds and deploys for you.

### 1. Supabase — database and auth

1. **Create the project.** [supabase.com/dashboard](https://supabase.com/dashboard)
   → **New project**. Pick a region near your users and save the database
   password somewhere safe.
2. **Create the schema.** Open **SQL Editor** → **New query**. Paste the
   contents of each file in `supabase/migrations/` and run them **in filename
   order** — the later files depend on the earlier ones:

   | #   | File                                   | What it creates                          |
   | --- | -------------------------------------- | ---------------------------------------- |
   | 1   | `20260914000100_init.sql`              | enums, tables, indexes                   |
   | 2   | `20260914000200_functions.sql`         | triggers, views, `save_assessment`       |
   | 3   | `20260914000300_rls.sql`               | Row Level Security policies and grants   |
   | 4   | `20260914000400_completion_rollup.sql` | `completed_at` and the completion rollup |

   Each one should finish with "Success. No rows returned."

3. **Copy the keys.** **Project Settings → API**. You need the **Project URL**
   and the **anon / public** key. Put them in your local `.env` (copy
   `.env.example`) and, later, into GitHub secrets.

   The **service_role** key is on the same page. It bypasses Row Level
   Security — it goes into the Cloudflare Worker only, never into `.env` and
   never into a GitHub secret used by an app build.

### 2. Google Cloud — the sign-in client

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project.
2. **APIs & Services → OAuth consent screen** → **External** → fill in app
   name, support email and developer contact.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Web application**.
4. Under **Authorised redirect URIs** add exactly:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

5. Copy the **client ID** and **client secret**.

> You only need the _Web_ client. Sign-in runs through Supabase's OAuth
> endpoint in a system browser on native, so there is no separate iOS or
> Android Google client to configure.

### 3. Supabase — turn on the providers

1. **Authentication → Sign In / Providers → Google**: enable it, paste the
   client ID and secret from step 2, save.
2. **Email** is enabled by default. While testing, turning **Confirm email**
   off lets you sign up without a round trip through your inbox.
3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:8081` during development, your real
     domain once the web app is live.
   - **Redirect URLs** — add all of these:

     ```
     muvozanat://auth/callback
     http://localhost:8081/auth/callback
     https://<your-web-domain>/auth/callback
     ```

   The `muvozanat://` entry is what lets the iOS and Android apps receive the
   callback. Without it, Google sign-in works on web and hangs on device.

### 4. Expo — project id and update URL

1. [expo.dev](https://expo.dev) → **Projects → Create a project**. The **slug**
   must be `muvozanat`, matching `app.json`.
2. Copy the **Project ID** (a UUID) from the project's overview page.
3. Edit `app.json` by hand and add both of these — `eas update` will not work
   without them:

   ```jsonc
   {
     "expo": {
       "owner": "<your expo account or organisation name>",
       "extra": {
         "router": {},
         "eas": { "projectId": "<the UUID you copied>" },
       },
       "updates": { "url": "https://u.expo.dev/<the same UUID>" },
     },
   }
   ```

   Commit that change — CI reads it.

4. **Account settings → Access tokens → Create token.** Copy it; it becomes the
   `EXPO_TOKEN` GitHub secret below.

### 5. Cloudflare — account, token, and the two projects

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**.
   Your **Account ID** is in the right-hand sidebar.
2. **My Profile → API Tokens → Create Token → Custom token.** Give it:
   - _Account → Workers Scripts → Edit_
   - _Account → Cloudflare Pages → Edit_
3. **Create the Pages project up front** so the deploy has somewhere to go:
   **Workers & Pages → Create → Pages → Upload assets**, name it exactly
   `muvozanat`. You can upload nothing; CI replaces the contents.
4. Edit `workers/reminders/wrangler.toml` and set `SUPABASE_URL` to your
   project URL. Commit it.

### 6. GitHub — secrets, label, and default branch

**Settings → Secrets and variables → Actions → New repository secret**:

| Secret                          | Value                      | Used by                        |
| ------------------------------- | -------------------------- | ------------------------------ |
| `EXPO_TOKEN`                    | Expo access token (step 4) | EAS build and update workflows |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase project URL       | every app build                |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon** key      | every app build                |
| `CLOUDFLARE_API_TOKEN`          | token from step 5          | web and worker deploys         |
| `CLOUDFLARE_ACCOUNT_ID`         | account id from step 5     | web and worker deploys         |

Then:

- **Settings → General → Default branch**: set it to `dev`. Create `main` when
  you are ready to ship — `main` is what drives production updates and deploys
  the worker.
- **Issues → Labels → New label**: create `build-preview`. Adding it to a pull
  request is what triggers a native build, so ordinary PRs do not each consume
  an EAS build.

### 7. The reminder worker's secret

The worker has to exist before you can give it a secret, and CI creates it on
the first deploy:

1. Push to `main` (or **Actions → Deploy reminder worker → Run workflow**).
2. **Workers & Pages → muvozanat-reminders → Settings → Variables and
   Secrets → Add** → type **Secret**, name `SUPABASE_SERVICE_ROLE_KEY`, value
   from Supabase step 1.3.
3. Optionally add `ADMIN_TRIGGER_SECRET` the same way; that enables
   `POST /run` so you can trigger a sweep by hand instead of waiting for
   06:00 UTC.
4. Re-run the deploy workflow so the worker picks the secret up.

Secrets set in the dashboard survive later deploys, so this is a one-off.

### 8. Run and build it

- **Web, locally**: `npm install`, then `npm run web`.
- **On a phone, no Mac or Android Studio needed**: **Actions → EAS preview
  build → Run workflow**, pick a platform. When it finishes, the build appears
  under your project on [expo.dev](https://expo.dev) with a QR code and an
  install link. Android gives you an APK you can install directly; iOS needs
  the device registered to your Apple Developer account, which Expo walks you
  through the first time.
- **After that, JS-only changes need no rebuild**: pushing to `dev` publishes
  an over-the-air update to the `preview` channel, and the installed app picks
  it up on next launch.

<details>
<summary>Prefer the command line?</summary>

```bash
npm install -g eas-cli supabase
supabase link --project-ref <ref> && supabase db push
eas login && eas init && eas update:configure
cd workers/reminders && npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

</details>

---

## What CI runs, and when

| Workflow            | Trigger                                                          | Does                                                                               |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ci.yml`            | every PR, push to `dev`/`main`                                   | lint, typecheck, unit tests, web export smoke test, worker typecheck               |
| `eas-preview.yml`   | PR labelled `build-preview`, or manual                           | publishes an OTA update to a `pr-<number>` branch and starts native preview builds |
| `eas-update.yml`    | push to `dev` → `preview` channel; push to `main` → `production` | re-runs the checks, then publishes the OTA update                                  |
| `deploy-web.yml`    | push to `dev`/`main`                                             | exports the static web build and deploys to Cloudflare Pages                       |
| `deploy-worker.yml` | push to `main` touching `workers/**`                             | deploys the reminder worker                                                        |

OTA updates reach users without review, so `eas-update.yml` re-runs lint,
typecheck and tests before publishing rather than trusting the PR that merged.

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
