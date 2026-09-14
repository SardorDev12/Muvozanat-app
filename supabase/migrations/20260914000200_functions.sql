-- Triggers, integrity checks and read helpers.

-- ------------------------------------------------------- updated_at ----

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger goals_touch_updated_at
  before update on public.goals
  for each row execute function public.touch_updated_at();

create trigger goal_components_touch_updated_at
  before update on public.goal_components
  for each row execute function public.touch_updated_at();

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- --------------------------------------------- profile bootstrapping ----

-- Every auth user gets a profile row. display_name is taken from the OAuth
-- payload when present (Google supplies `name`), otherwise from the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------- derived reminder date ----

-- next_reassess_at would be a GENERATED column if Postgres allowed it, but
-- `timestamptz + interval` is only STABLE (adding days consults the session
-- time zone for DST), so it is maintained here instead. Running BEFORE the row
-- is written means the column is always consistent with its two inputs, and a
-- client that tries to set it directly is simply overruled.
create or replace function public.compute_next_reassess()
returns trigger
language plpgsql
as $$
begin
  if new.last_assessment_at is null or new.reassess_interval_days is null then
    new.next_reassess_at := null;
  else
    new.next_reassess_at :=
      new.last_assessment_at + make_interval(days => new.reassess_interval_days);
  end if;
  return new;
end;
$$;

-- Fires on every insert and update rather than only when the two inputs are
-- in the SET list: a client can reach this table directly under RLS, and
-- limiting the trigger to those columns would let an update that touched only
-- next_reassess_at write an arbitrary due date that nothing ever corrected.
create trigger profiles_compute_next_reassess
  before insert or update on public.profiles
  for each row execute function public.compute_next_reassess();

-- ------------------------------------------ assessment bookkeeping ----

-- Keeps profiles.last_assessment_at in step so next_reassess_at stays correct
-- without the client having to remember to write it.
create or replace function public.sync_last_assessment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set last_assessment_at = (
       select max(a.taken_at) from public.assessments a where a.user_id = target_user
     ),
         -- A completed assessment supersedes any "remind me later".
         reassess_snoozed_until = case when tg_op = 'INSERT' then null
                                       else p.reassess_snoozed_until end
   where p.id = target_user;

  return null;
end;
$$;

create trigger assessments_sync_profile
  after insert or update or delete on public.assessments
  for each row execute function public.sync_last_assessment();

-- --------------------------------------------- task parent integrity ----

-- The CHECK constraint can only see one row, so cross-table consistency
-- (component belongs to the same goal, and both belong to the same user)
-- is enforced here.
create or replace function public.validate_task_parents()
returns trigger
language plpgsql
as $$
declare
  component_goal uuid;
  component_owner uuid;
  goal_owner uuid;
begin
  if new.component_id is not null then
    select gc.goal_id, gc.user_id into component_goal, component_owner
      from public.goal_components gc where gc.id = new.component_id;

    if component_goal is null then
      raise exception 'component % does not exist', new.component_id;
    end if;
    if component_owner <> new.user_id then
      raise exception 'component belongs to another user';
    end if;
    if new.goal_id is distinct from component_goal then
      raise exception 'task.goal_id must match the component''s goal';
    end if;
  end if;

  if new.goal_id is not null then
    select g.user_id into goal_owner from public.goals g where g.id = new.goal_id;
    if goal_owner is null then
      raise exception 'goal % does not exist', new.goal_id;
    end if;
    if goal_owner <> new.user_id then
      raise exception 'goal belongs to another user';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_validate_parents
  before insert or update of goal_id, component_id, user_id on public.tasks
  for each row execute function public.validate_task_parents();

-- --------------------------------------------------- read helpers ----

-- Wheel history, one row per assessment per area, ready for the trend chart.
create or replace view public.assessment_history
with (security_invoker = true)
as
select
  a.id as assessment_id,
  a.user_id,
  a.taken_at,
  s.area,
  s.score
from public.assessments a
join public.assessment_scores s on s.assessment_id = a.id;

-- Goal progress, counting completed tasks against total tasks. A recurring
-- task counts as complete once it has at least one completion, which is the
-- honest reading of "is this milestone moving".
create or replace view public.goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.user_id,
  count(t.id) filter (where t.status = 'active') as total_tasks,
  count(distinct c.task_id) filter (where c.status = 'done') as done_tasks
from public.goals g
left join public.tasks t on t.goal_id = g.id and t.status = 'active'
left join public.task_completions c on c.task_id = t.id
group by g.id, g.user_id;

-- Saves the whole wheel in one round trip: one assessment row plus its eight
-- scores, atomically. `scores` is {"health": 7, "career": 4, ...}.
create or replace function public.save_assessment(scores jsonb, note text default null)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  expected_areas integer;
  provided_areas integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into expected_areas from unnest(enum_range(null::public.life_area));
  select count(*) into provided_areas from jsonb_object_keys(scores);

  if provided_areas <> expected_areas then
    raise exception 'expected % areas, got %', expected_areas, provided_areas;
  end if;

  insert into public.assessments (user_id, note) values (uid, note) returning id into new_id;

  insert into public.assessment_scores (assessment_id, user_id, area, score)
  select new_id, uid, key::public.life_area, (value #>> '{}')::smallint
    from jsonb_each(scores);

  return new_id;
end;
$$;
