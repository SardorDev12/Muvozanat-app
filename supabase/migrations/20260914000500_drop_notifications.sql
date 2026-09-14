-- Removes the notifications table and the reminder worker that fed it.
--
-- The table existed for one purpose: a nightly Cloudflare Worker wrote a
-- `reassessment_due` row so the app could show its banner. That never earned
-- its keep. The app already decides the banner itself, by comparing
-- profiles.next_reassess_at to the clock when it opens, so the rows only ever
-- duplicated a check the client was doing anyway. The Worker's one unique
-- ability — reaching someone who is not opening the app — needed push tokens
-- that nothing ever registered.
--
-- Dropping it also retires the last use of the service_role key: every
-- remaining read and write goes through the app under Row Level Security.

-- The assessment trigger cleared outstanding nudges; with no table to clear,
-- it only has to keep last_assessment_at and the snooze in step.
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

drop table if exists public.notifications;
