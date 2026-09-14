-- Muvozanat core schema.
--
-- Design notes
--  * Life areas are a Postgres enum so a typo can never create a ninth area.
--    The values mirror LIFE_AREA_KEYS in src/features/assessment/areas.ts.
--  * Recurring tasks are stored as ONE row with a recurrence rule, not as a
--    materialised row per occurrence. Occurrences are expanded in TypeScript
--    (src/features/tasks/recurrence.ts) and only deviations from "not done yet"
--    — completions and skips — get a row in task_completions. This keeps a
--    "run every weekday forever" task at a single row.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

create type public.life_area as enum (
  'health',
  'career',
  'finance',
  'relationships',
  'family',
  'growth',
  'fun',
  'spirituality'
);

create type public.goal_status as enum ('active', 'paused', 'done', 'archived');

create type public.component_status as enum ('active', 'done', 'archived');

create type public.task_status as enum ('active', 'archived');

create type public.completion_status as enum ('done', 'skipped');

-- ------------------------------------------------------------- profiles ----

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'uz' check (locale in ('uz', 'ru', 'en')),
  timezone text not null default 'UTC',
  -- NULL disables reassessment reminders entirely. Default is quarterly.
  reassess_interval_days integer default 90 check (
    reassess_interval_days is null or reassess_interval_days between 1 and 730
  ),
  -- Maintained by a trigger on public.assessments.
  last_assessment_at timestamptz,
  -- Derived from last_assessment_at + reassess_interval_days by the
  -- profiles_compute_next_reassess trigger. It cannot be a GENERATED column:
  -- `timestamptz + interval` is STABLE rather than IMMUTABLE, because adding
  -- days has to consult the session time zone to get DST right, and Postgres
  -- rejects a non-immutable generation expression.
  next_reassess_at timestamptz,
  -- Set when the user taps "remind me later"; the nudge stays quiet until then.
  reassess_snoozed_until timestamptz,
  -- How far back the Today screen looks for missed occurrences.
  missed_lookback_days integer not null default 14 check (missed_lookback_days between 1 and 90),
  expo_push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.next_reassess_at is
  'Derived reminder due date, maintained by trigger. The Cloudflare Worker cron reads this column.';

-- The Worker sweeps on this column daily.
create index profiles_reassess_due_idx on public.profiles (next_reassess_at)
  where next_reassess_at is not null;

-- ---------------------------------------------------------- assessments ----

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index assessments_user_taken_idx on public.assessments (user_id, taken_at desc);

create table public.assessment_scores (
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  area public.life_area not null,
  score smallint not null check (score between 1 and 10),
  primary key (assessment_id, area)
);

create index assessment_scores_user_area_idx on public.assessment_scores (user_id, area);

-- ---------------------------------------------------------------- goals ----

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area public.life_area not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  target_date date,
  status public.goal_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_status_idx on public.goals (user_id, status, sort_order);

create table public.goal_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  status public.component_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_components_goal_idx on public.goal_components (goal_id, sort_order);

-- ---------------------------------------------------------------- tasks ----

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Flexible hierarchy: a task may hang off a component, directly off a goal,
  -- or off nothing at all (a quick capture).
  goal_id uuid references public.goals (id) on delete cascade,
  component_id uuid references public.goal_components (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  -- Single-shot tasks use due_date. Recurring tasks use starts_on + recurrence
  -- and leave due_date null.
  due_date date,
  starts_on date,
  recurrence jsonb,
  status public.task_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A task is either one-off or recurring, never both and never neither-typed.
  constraint tasks_schedule_shape check (
    (recurrence is null and starts_on is null)
    or (recurrence is not null and starts_on is not null and due_date is null)
  ),
  -- If it belongs to a component it must belong to that component's goal too;
  -- enforced fully by the trigger below, shape-checked here.
  constraint tasks_component_needs_goal check (component_id is null or goal_id is not null)
);

create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_idx on public.tasks (user_id, due_date) where due_date is not null;
create index tasks_user_recurring_idx on public.tasks (user_id) where recurrence is not null;
create index tasks_goal_idx on public.tasks (goal_id);
create index tasks_component_idx on public.tasks (component_id);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- The calendar day this row refers to. For one-off tasks it equals due_date.
  occurrence_date date not null,
  status public.completion_status not null default 'done',
  completed_at timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create index task_completions_user_date_idx on public.task_completions (user_id, occurrence_date);
