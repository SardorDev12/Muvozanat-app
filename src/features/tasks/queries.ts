import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/state/queryKeys';
import type { TaskCompletionRow, TaskRow } from '@/types/database';
import { addDays, todayKey, type DateKey } from '@/utils/date';

import type { Recurrence } from './recurrence';
import { buildTodayLists, type TodayLists } from './today';

export type TaskInput = {
  title: string;
  notes?: string | null;
  goal_id?: string | null;
  component_id?: string | null;
  due_date?: DateKey | null;
  starts_on?: DateKey | null;
  recurrence?: Recurrence | null;
};

/**
 * Live tasks, plus any finished recently enough to still show in a visible
 * list. A personal planner holds tens, not thousands, of task rows — recurring
 * tasks are one row each — so fetching them together and expanding occurrences
 * on the client is both simpler and fewer round trips than querying per day.
 *
 * `finishedSince` stops retired tasks piling up in this fetch forever while
 * still returning the ones the Completed section needs to render.
 */
export function useTasks(finishedSince?: DateKey) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: [...queryKeys.tasks(userId ?? 'anonymous'), finishedSince ?? 'all'],
    enabled: !!userId,
    queryFn: async (): Promise<TaskRow[]> => {
      let query = supabase.from('tasks').select('*').eq('user_id', userId!).eq('status', 'active');

      if (finishedSince) {
        query = query.or(`completed_at.is.null,completed_at.gte.${finishedSince}`);
      }

      const { data, error } = await query
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCompletions(from: DateKey, to: DateKey) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.completions(userId ?? 'anonymous', from, to),
    enabled: !!userId,
    queryFn: async (): Promise<TaskCompletionRow[]> => {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', userId!)
        .gte('occurrence_date', from)
        .lte('occurrence_date', to);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The three lists the Today screen renders. */
export function useTodayLists(lookbackDays: number, date: DateKey = todayKey()) {
  const from = addDays(date, -Math.max(1, lookbackDays));
  const tasks = useTasks(from);
  const completions = useCompletions(from, date);

  const lists = useMemo<TodayLists<TaskRow>>(
    () => buildTodayLists(tasks.data ?? [], completions.data ?? [], date, lookbackDays),
    [tasks.data, completions.data, date, lookbackDays],
  );

  return {
    lists,
    isLoading: tasks.isLoading || completions.isLoading,
    isError: tasks.isError || completions.isError,
    error: tasks.error ?? completions.error,
    refetch: async () => {
      await Promise.all([tasks.refetch(), completions.refetch()]);
    },
  };
}

export function useTasksForGoal(goalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasksForGoal(goalId ?? 'none'),
    enabled: !!goalId,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('goal_id', goalId!)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useTaskInvalidation() {
  const { user } = useAuth();
  const client = useQueryClient();

  return (goalId?: string | null) => {
    if (user) {
      client.invalidateQueries({ queryKey: queryKeys.tasks(user.id) });
      client.invalidateQueries({ queryKey: ['completions', user.id] });
      client.invalidateQueries({ queryKey: queryKeys.goalProgress(user.id) });
    }
    if (goalId) client.invalidateQueries({ queryKey: queryKeys.tasksForGoal(goalId) });
  };
}

export function useCreateTask() {
  const { user } = useAuth();
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async (input: TaskInput) => {
      if (!user) throw new Error('Not signed in');

      // The database enforces this too, but failing here gives a message the
      // form can show instead of a Postgres constraint name.
      const recurring = !!input.recurrence;
      if (recurring && !input.starts_on) {
        throw new Error('A repeating task needs a start date');
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: input.title.trim(),
          notes: input.notes?.trim() || null,
          goal_id: input.goal_id ?? null,
          component_id: input.component_id ?? null,
          due_date: recurring ? null : (input.due_date ?? null),
          starts_on: recurring ? (input.starts_on ?? null) : null,
          recurrence: input.recurrence ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => invalidate(task.goal_id),
  });
}

export function useUpdateTask() {
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskRow> }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => invalidate(task.goal_id),
  });
}

export function useDeleteTask() {
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId?: string | null }) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return goalId ?? null;
    },
    onSuccess: (goalId) => invalidate(goalId),
  });
}

/**
 * How much of a task the user meant to finish.
 *
 * `occurrence` closes out today's run and leaves a repeating task live;
 * `task` retires the task itself, which is what rolls its component — and in
 * turn its goal — up to complete. For a one-off task the two are the same
 * thing, so the UI only asks when the task repeats.
 */
export type CompletionScope = 'occurrence' | 'task';

/**
 * Records (or clears) what happened to one occurrence of a task, and keeps
 * `tasks.completed_at` in step.
 *
 * Clearing removes the occurrence row — the absence of a row is the canonical
 * "not done yet" — and also un-retires the task, so unticking something always
 * lands back in a state the user can act on.
 *
 * Both writes go through one mutation so the two can never end up half
 * applied: a retired task with no completion row would vanish from every list.
 */
export function useSetOccurrenceStatus() {
  const { user } = useAuth();
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async ({
      taskId,
      date,
      status,
      scope = 'occurrence',
    }: {
      taskId: string;
      date: DateKey;
      status: 'done' | 'skipped' | null;
      scope?: CompletionScope;
    }) => {
      if (!user) throw new Error('Not signed in');

      if (status === null) {
        const { error } = await supabase
          .from('task_completions')
          .delete()
          .eq('task_id', taskId)
          .eq('occurrence_date', date);
        if (error) throw error;

        const { error: reopenError } = await supabase
          .from('tasks')
          .update({ completed_at: null })
          .eq('id', taskId)
          .not('completed_at', 'is', null);
        if (reopenError) throw reopenError;
        return;
      }

      const { error } = await supabase.from('task_completions').upsert(
        {
          user_id: user.id,
          task_id: taskId,
          occurrence_date: date,
          status,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,occurrence_date' },
      );
      if (error) throw error;

      // Only a 'done' can retire a task; skipping an occurrence never does.
      if (scope === 'task' && status === 'done') {
        const { error: retireError } = await supabase
          .from('tasks')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', taskId);
        if (retireError) throw retireError;
      }
    },
    onSuccess: () => invalidate(),
  });
}

/** Reopens a finished task without touching its occurrence history. */
export function useReopenTask() {
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async (task: TaskRow) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ completed_at: null })
        .eq('id', task.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => invalidate(task.goal_id),
  });
}

/** Moves a missed one-off task onto today. Recurring tasks are left alone. */
export function useMoveTaskToToday() {
  const invalidate = useTaskInvalidation();

  return useMutation({
    mutationFn: async (task: TaskRow) => {
      if (task.recurrence) throw new Error('Repeating tasks cannot be moved');
      const { data, error } = await supabase
        .from('tasks')
        .update({ due_date: todayKey() })
        .eq('id', task.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => invalidate(task.goal_id),
  });
}
