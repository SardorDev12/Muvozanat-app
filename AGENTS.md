# Muvozanat — notes for agents

Expo SDK 57. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing any code — the API
surface moves between SDKs.

## Ground rules specific to this repo

- **No `babel.config.js`.** SDK 57's `babel-preset-expo` is nested under
  `expo/node_modules`, so a project-level babel config cannot resolve it and
  Metro fails to construct a transformer. The preset already adds
  `react-native-worklets/plugin` automatically when the package is installed.
- **Web output stays `"single"`, and the SPA fallback must stay configured.**
  Expo Router's web build is a SPA, so without `not_found_handling =
"single-page-application"` in the root `wrangler.toml`, `/today` or a refresh
  of `/goals/<id>` 404s. That setting is the Workers equivalent of the
  `/* /index.html 200` rule Cloudflare Pages needed in `_redirects`; the site
  moved from Pages to an assets-only Worker, so `public/_redirects` is gone and
  adding one back would do nothing. `"static"` output was tried and reverted:
  every route sits behind a client-side auth gate, so prerendering emits only
  wrapper divs, and those hydrate against a different theme and safe-area
  measurement — React error #418 on every page load, in both colour schemes.
  `app/+html.tsx` is ignored under `"single"`; do not add one back expecting it
  to apply.
- **Two Workers, two configs.** The root `wrangler.toml` is the website, an
  assets-only Worker with no `main` script. `workers/reminders/wrangler.toml` is
  the nightly reminder cron. Deploying one must never pick up the other's
  config.
- **i18next initialises synchronously at import.** Gating the tree on an async
  init cost a blank first frame on every launch. `hydrateStoredLanguage()`
  applies a saved preference after the first paint.
- **Dates are calendar days, not instants.** Anything crossing the API boundary
  is a `YYYY-MM-DD` string. See `src/utils/date.ts`.
- **Recurring tasks are one row.** Occurrences are expanded in TypeScript
  (`src/features/tasks/recurrence.ts`); only completions and skips get rows.
  Never materialise occurrences into the database.
- **A task has two notions of "done".** A `task_completions` row means _this
  occurrence_ is handled; `tasks.completed_at` means _the task itself_ is
  finished. Only the second one rolls up. For a repeating task the UI asks
  which the user meant; for a one-off it completes both without asking.
- **Completion rolls upward in the database, not the client.** Triggers in
  `20260914000400_completion_rollup.sql` recompute component status from its
  tasks and goal status from its components and direct tasks. A component or
  goal with no children keeps whatever status the user set by hand. Never
  compute a parent's completion in the app — it would disagree with whatever
  another client wrote.
- **Life area keys are a Postgres enum.** Changing `LIFE_AREA_KEYS` in
  `src/features/assessment/areas.ts` requires a migration.
- **RLS is the whole access model.** The app talks to Postgres directly with the
  anon key. Any new table needs policies in the RLS migration.
- **English is the source of truth for copy.** `src/i18n/locales/en.ts` defines
  the `Translations` type; `ru.ts` and `uz.ts` must satisfy it, so a missing key
  is a typecheck failure.

## Checks

```bash
npm run lint && npm run typecheck && npm test
npm run test:schema   # needs Postgres; see scripts/test-schema.sh
```

`npm test` compiles the pure-logic modules with `tsconfig.test.json` and runs
them under `node --test`. The recurrence and Today-list rules are covered there;
add cases rather than reasoning about calendars by hand.

`npm run test:schema` applies every migration to a throwaway Postgres and runs
`supabase/tests/schema_test.sql`. **Any change to a migration must go through
it** — typechecking cannot see a non-immutable generated column, a trigger that
never fires, or an RLS policy that leaks another user's rows. Add an assertion
for every invariant you introduce, and check it fails when you break the thing
it guards.

- **`next_reassess_at` is derived, not stored by the client.** The
  `profiles_compute_next_reassess` trigger recomputes it on _every_ insert and
  update. It deliberately has no `UPDATE OF` column list: clients reach this
  table directly under RLS, so a narrower trigger would let an update touching
  only that column write an arbitrary due date.
