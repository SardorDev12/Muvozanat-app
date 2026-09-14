-- Row Level Security. Every table is user-scoped; the app talks to Postgres
-- directly with the anon key, so these policies are the entire access model.

alter table public.profiles            enable row level security;
alter table public.assessments         enable row level security;
alter table public.assessment_scores   enable row level security;
alter table public.goals               enable row level security;
alter table public.goal_components     enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_completions    enable row level security;
alter table public.notifications       enable row level security;

-- ------------------------------------------------------------ profiles ----
-- No INSERT policy: rows are created by the on_auth_user_created trigger.
-- No DELETE policy: profiles die with the auth user via ON DELETE CASCADE.

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- --------------------------------------------------------- assessments ----

create policy "assessments: read own"
  on public.assessments for select using (auth.uid() = user_id);

create policy "assessments: insert own"
  on public.assessments for insert with check (auth.uid() = user_id);

create policy "assessments: update own"
  on public.assessments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assessments: delete own"
  on public.assessments for delete using (auth.uid() = user_id);

create policy "assessment_scores: read own"
  on public.assessment_scores for select using (auth.uid() = user_id);

create policy "assessment_scores: insert own"
  on public.assessment_scores for insert with check (auth.uid() = user_id);

create policy "assessment_scores: update own"
  on public.assessment_scores for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "assessment_scores: delete own"
  on public.assessment_scores for delete using (auth.uid() = user_id);

-- --------------------------------------------------------------- goals ----

create policy "goals: read own"
  on public.goals for select using (auth.uid() = user_id);

create policy "goals: insert own"
  on public.goals for insert with check (auth.uid() = user_id);

create policy "goals: update own"
  on public.goals for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals: delete own"
  on public.goals for delete using (auth.uid() = user_id);

create policy "goal_components: read own"
  on public.goal_components for select using (auth.uid() = user_id);

create policy "goal_components: insert own"
  on public.goal_components for insert with check (auth.uid() = user_id);

create policy "goal_components: update own"
  on public.goal_components for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goal_components: delete own"
  on public.goal_components for delete using (auth.uid() = user_id);

-- --------------------------------------------------------------- tasks ----

create policy "tasks: read own"
  on public.tasks for select using (auth.uid() = user_id);

create policy "tasks: insert own"
  on public.tasks for insert with check (auth.uid() = user_id);

create policy "tasks: update own"
  on public.tasks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks: delete own"
  on public.tasks for delete using (auth.uid() = user_id);

create policy "task_completions: read own"
  on public.task_completions for select using (auth.uid() = user_id);

create policy "task_completions: insert own"
  on public.task_completions for insert with check (auth.uid() = user_id);

create policy "task_completions: update own"
  on public.task_completions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "task_completions: delete own"
  on public.task_completions for delete using (auth.uid() = user_id);

-- ------------------------------------------------------- notifications ----
-- Inserted only by the Worker (service role, which bypasses RLS). Users may
-- read their own and dismiss them.

create policy "notifications: read own"
  on public.notifications for select using (auth.uid() = user_id);

create policy "notifications: update own"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------- grants ----

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.assessments,
  public.assessment_scores,
  public.goals,
  public.goal_components,
  public.tasks,
  public.task_completions,
  public.notifications
to authenticated;
grant select on public.assessment_history, public.goal_progress to authenticated;
grant execute on function public.save_assessment(jsonb, text) to authenticated;
