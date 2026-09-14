# Muvozanat — notes for agents

Expo SDK 57. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing any code — the API
surface moves between SDKs.

## Ground rules specific to this repo

- **No `babel.config.js`.** SDK 57's `babel-preset-expo` is nested under
  `expo/node_modules`, so a project-level babel config cannot resolve it and
  Metro fails to construct a transformer. The preset already adds
  `react-native-worklets/plugin` automatically when the package is installed.
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
```

`npm test` compiles the pure-logic modules with `tsconfig.test.json` and runs
them under `node --test`. The recurrence and Today-list rules are covered there;
add cases rather than reasoning about calendars by hand.
