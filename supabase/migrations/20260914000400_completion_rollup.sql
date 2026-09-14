-- Completion rolls up: tasks make a component, components make a goal.
--
-- A task now has two distinct notions of "done":
--   * a `task_completions` row  — this OCCURRENCE is handled (today's run).
--   * `tasks.completed_at`      — the TASK ITSELF is finished and retired.
-- For a one-off task the two happen together. For a repeating task they are
-- very different: ticking off today's run must not retire the habit, so the
-- app asks which the user means.
--
-- `completed_at` is a column rather than a new `task_status` enum value on
-- purpose: `alter type ... add value` cannot be used in the same transaction
-- that references the new value, which would force this migration to be split.
-- The timestamp also records *when*, which the enum would not.

alter table public.tasks
  add column completed_at timestamptz;

comment on column public.tasks.completed_at is
  'Set when the whole task is finished, not merely this occurrence. Null means still live.';

create index tasks_goal_open_idx on public.tasks (goal_id) where completed_at is null;

-- ------------------------------------------------------------- rollup ----

-- A component is complete when it has tasks and none of them are outstanding.
-- A component with no tasks keeps whatever status the user set by hand, so an
-- empty milestone can still be ticked off.
create or replace function public.recompute_component_status(target_component uuid)
returns void
language plpgsql
as $$
declare
  total integer;
  outstanding integer;
  desired public.component_status;
begin
  if target_component is null then
    return;
  end if;

  select count(*), count(*) filter (where completed_at is null)
    into total, outstanding
    from public.tasks
   where component_id = target_component
     and status = 'active';

  if total = 0 then
    return;
  end if;

  desired := case when outstanding = 0 then 'done' else 'active' end;

  -- Only write on an actual change: this keeps the goal-level trigger from
  -- firing on every task tick, and stops two triggers ping-ponging updates.
  update public.goal_components
     set status = desired
   where id = target_component
     and status is distinct from desired
     and status <> 'archived';
end;
$$;

-- A goal is complete when every component is done and every task hanging
-- directly off it is finished. A goal with neither keeps its manual status.
create or replace function public.recompute_goal_status(target_goal uuid)
returns void
language plpgsql
as $$
declare
  component_total integer;
  component_open integer;
  direct_total integer;
  direct_open integer;
  desired public.goal_status;
begin
  if target_goal is null then
    return;
  end if;

  select count(*), count(*) filter (where status <> 'done')
    into component_total, component_open
    from public.goal_components
   where goal_id = target_goal
     and status <> 'archived';

  select count(*), count(*) filter (where completed_at is null)
    into direct_total, direct_open
    from public.tasks
   where goal_id = target_goal
     and component_id is null
     and status = 'active';

  if component_total + direct_total = 0 then
    return;
  end if;

  desired := case when component_open + direct_open = 0 then 'done' else 'active' end;

  -- 'paused' and 'archived' are deliberate user states; the rollup does not
  -- override them, and it only reopens a goal it could itself have closed.
  update public.goals
     set status = desired
   where id = target_goal
     and status is distinct from desired
     and status in ('active', 'done');
end;
$$;

create or replace function public.tasks_rollup()
returns trigger
language plpgsql
as $$
begin
  -- Both sides on an update, so moving a task between components settles the
  -- component it left as well as the one it joined.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_component_status(old.component_id);
    perform public.recompute_goal_status(old.goal_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_component_status(new.component_id);
    perform public.recompute_goal_status(new.goal_id);
  end if;

  return null;
end;
$$;

create trigger tasks_rollup_completion
  after insert or delete
     or update of completed_at, component_id, goal_id, status
  on public.tasks
  for each row execute function public.tasks_rollup();

create or replace function public.components_rollup()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_goal_status(old.goal_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_goal_status(new.goal_id);
  end if;
  return null;
end;
$$;

create trigger goal_components_rollup_completion
  after insert or delete or update of status, goal_id
  on public.goal_components
  for each row execute function public.components_rollup();

-- --------------------------------------------------------- progress ----

-- Progress now counts finished tasks, not tasks that were ticked off once.
-- A habit that repeats three times a week holds its component open until the
-- user says the habit itself is finished, which is the honest reading of
-- "am I done with this milestone".
create or replace view public.goal_progress
with (security_invoker = true)
as
select
  g.id as goal_id,
  g.user_id,
  count(t.id) as total_tasks,
  count(t.id) filter (where t.completed_at is not null) as done_tasks
from public.goals g
left join public.tasks t on t.goal_id = g.id and t.status = 'active'
group by g.id, g.user_id;

grant select on public.goal_progress to authenticated;
