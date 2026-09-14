-- Behavioural tests for the schema: triggers, the completion rollup, the
-- derived reminder date, and Row Level Security.
--
-- Run against a throwaway Postgres that already has supabase/tests/stub.sql
-- applied, followed by every file in supabase/migrations in order. See the
-- `schema` job in .github/workflows/ci.yml, or scripts/test-schema.sh locally.
--
-- Any failed assertion aborts the script with a message naming the rule.

\set ON_ERROR_STOP on
\set u1 '11111111-1111-1111-1111-111111111111'
\set u2 '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'u1', 'ann@example.com', '{"full_name": "Ann"}'::jsonb),
  (:'u2', 'bo@example.com', '{}'::jsonb);

-- ----------------------------------------------- profile bootstrapping ----

do $$
begin
  assert (select count(*) from public.profiles) = 2,
    'every auth user should get a profile row';
  assert (select display_name from public.profiles
           where id = '11111111-1111-1111-1111-111111111111') = 'Ann',
    'display_name should come from the OAuth full_name claim';
  assert (select display_name from public.profiles
           where id = '22222222-2222-2222-2222-222222222222') = 'bo',
    'display_name should fall back to the email local part';
  assert (select reassess_interval_days from public.profiles
           where id = '11111111-1111-1111-1111-111111111111') = 90,
    'reassessment should default to quarterly';
  assert (select count(*) from public.profiles where next_reassess_at is not null) = 0,
    'next_reassess_at stays null until there is an assessment to count from';
end $$;

-- ------------------------------------------------------- save_assessment ----

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select public.save_assessment(
  '{"health":7,"career":4,"finance":3,"relationships":8,
    "family":6,"growth":5,"fun":2,"spirituality":9}'::jsonb
);

do $$
begin
  assert (select count(*) from public.assessments) = 1,
    'save_assessment should create exactly one assessment';
  assert (select count(*) from public.assessment_scores) = 8,
    'save_assessment should write one score per life area';
  assert (select score from public.assessment_scores where area = 'fun') = 2,
    'scores should land on the area they were keyed under';
end $$;

reset role;

do $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';

  assert p.last_assessment_at is not null,
    'the assessment trigger should stamp last_assessment_at';
  assert p.next_reassess_at = p.last_assessment_at + interval '90 days',
    'next_reassess_at should be last_assessment_at plus the interval';
end $$;

-- Changing the cadence re-derives the due date.
update public.profiles set reassess_interval_days = 30
 where id = :'u1';

do $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  assert p.next_reassess_at = p.last_assessment_at + interval '30 days',
    'changing the interval should re-derive next_reassess_at';
end $$;

-- Turning reminders off clears it.
update public.profiles set reassess_interval_days = null where id = :'u1';

do $$
begin
  assert (select next_reassess_at from public.profiles
           where id = '11111111-1111-1111-1111-111111111111') is null,
    'a null interval means no reminder date at all';
end $$;

update public.profiles set reassess_interval_days = 90 where id = :'u1';

-- next_reassess_at is derived, so a client writing it directly is overruled
-- rather than being able to silence or fake its own reminder.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

update public.profiles
   set next_reassess_at = now() + interval '10 years'
 where id = '11111111-1111-1111-1111-111111111111';

reset role;

do $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles
   where id = '11111111-1111-1111-1111-111111111111';
  assert p.next_reassess_at = p.last_assessment_at + interval '90 days',
    'a direct write to next_reassess_at should be recomputed away';
end $$;

-- A partial wheel is rejected rather than silently stored.
do $$
begin
  begin
    perform set_config('request.jwt.claim.sub',
                       '11111111-1111-1111-1111-111111111111', true);
    perform public.save_assessment('{"health":7}'::jsonb);
    assert false, 'save_assessment should reject a wheel that is missing areas';
  exception when others then
    assert sqlerrm like '%expected%areas%', 'unexpected error: ' || sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------- rollup ----

insert into public.goals (id, user_id, area, title)
values ('33333333-3333-3333-3333-333333333333', :'u1', 'fun', 'Learn to sail');

insert into public.goal_components (id, user_id, goal_id, title)
values ('44444444-4444-4444-4444-444444444444', :'u1',
        '33333333-3333-3333-3333-333333333333', 'Pass the theory exam');

insert into public.tasks (id, user_id, goal_id, component_id, title, due_date)
values
  ('55555555-5555-5555-5555-555555555555', :'u1',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444', 'Read chapters 1-4', '2026-09-20'),
  ('66666666-6666-6666-6666-666666666666', :'u1',
   '33333333-3333-3333-3333-333333333333',
   '44444444-4444-4444-4444-444444444444', 'Sit a mock paper', '2026-09-27');

do $$
begin
  assert (select status from public.goal_components
           where id = '44444444-4444-4444-4444-444444444444') = 'active',
    'a component with outstanding tasks is not done';
end $$;

-- Finishing one of two tasks must not close the component.
update public.tasks set completed_at = now()
 where id = '55555555-5555-5555-5555-555555555555';

do $$
begin
  assert (select status from public.goal_components
           where id = '44444444-4444-4444-4444-444444444444') = 'active',
    'one task of two finished should leave the component open';
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'active',
    'the goal should still be open too';
end $$;

-- Finishing the last one closes the component, and the goal behind it.
update public.tasks set completed_at = now()
 where id = '66666666-6666-6666-6666-666666666666';

do $$
begin
  assert (select status from public.goal_components
           where id = '44444444-4444-4444-4444-444444444444') = 'done',
    'every task finished should close the component';
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'done',
    'every component done should close the goal';
end $$;

-- Reopening a task reopens everything above it.
update public.tasks set completed_at = null
 where id = '66666666-6666-6666-6666-666666666666';

do $$
begin
  assert (select status from public.goal_components
           where id = '44444444-4444-4444-4444-444444444444') = 'active',
    'reopening a task should reopen its component';
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'active',
    'reopening a component should reopen its goal';
end $$;

-- A task hanging straight off the goal holds the goal open on its own.
update public.tasks set completed_at = now()
 where id = '66666666-6666-6666-6666-666666666666';

insert into public.tasks (id, user_id, goal_id, title, due_date)
values ('77777777-7777-7777-7777-777777777777', :'u1',
        '33333333-3333-3333-3333-333333333333', 'Book the exam', '2026-10-01');

do $$
begin
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'active',
    'an unfinished direct task should hold the goal open';
end $$;

update public.tasks set completed_at = now()
 where id = '77777777-7777-7777-7777-777777777777';

do $$
begin
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'done',
    'the goal closes once its components and direct tasks are all finished';
end $$;

-- A paused goal is a deliberate user state the rollup must not overwrite.
update public.goals set status = 'paused'
 where id = '33333333-3333-3333-3333-333333333333';
update public.tasks set completed_at = null
 where id = '77777777-7777-7777-7777-777777777777';

do $$
begin
  assert (select status from public.goals
           where id = '33333333-3333-3333-3333-333333333333') = 'paused',
    'the rollup must leave paused and archived goals alone';
end $$;

update public.goals set status = 'active'
 where id = '33333333-3333-3333-3333-333333333333';

-- ----------------------------------------------------------- progress ----

do $$
declare
  total integer;
  done integer;
begin
  select total_tasks, done_tasks into total, done
    from public.goal_progress
   where goal_id = '33333333-3333-3333-3333-333333333333';

  assert total = 3, format('expected 3 tasks, got %s', total);
  assert done = 2, format('expected 2 finished tasks, got %s', done);
end $$;

-- --------------------------------------------------- shape constraints ----

do $$
begin
  begin
    insert into public.tasks (user_id, title, recurrence)
    values ('11111111-1111-1111-1111-111111111111', 'No start date',
            '{"freq":"daily","interval":1}'::jsonb);
    assert false, 'a recurring task without starts_on should be rejected';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, title, starts_on, due_date, recurrence)
    values ('11111111-1111-1111-1111-111111111111', 'Both schedules',
            '2026-09-14', '2026-09-14', '{"freq":"daily","interval":1}'::jsonb);
    assert false, 'a task cannot be both one-off and recurring';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, goal_id, component_id, title, due_date)
    values ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333',
            '44444444-4444-4444-4444-444444444444', 'Wrong owner', '2026-09-14');
  exception when others then
    assert false, 'a task matching its component''s goal should be accepted: ' || sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------------ RLS ----

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
begin
  assert (select count(*) from public.goals) = 0,
    'RLS should hide another user''s goals';
  assert (select count(*) from public.tasks) = 0,
    'RLS should hide another user''s tasks';
  assert (select count(*) from public.assessments) = 0,
    'RLS should hide another user''s assessments';
  assert (select count(*) from public.profiles) = 1,
    'a user should see exactly their own profile';
end $$;

-- Writing a row owned by someone else must be refused, not silently accepted.
do $$
begin
  begin
    insert into public.goals (user_id, area, title)
    values ('11111111-1111-1111-1111-111111111111', 'fun', 'Smuggled goal');
    assert false, 'RLS should refuse an insert attributed to another user';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
begin
  assert (select count(*) from public.goals) = 1,
    'a user should see their own goal';
end $$;

reset role;

\echo '=== all schema assertions passed ==='
