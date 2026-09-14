import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { LifeAreaKey } from '@/features/assessment/areas';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/state/queryKeys';
import type {
  ComponentStatus,
  GoalComponentRow,
  GoalProgressRow,
  GoalRow,
  GoalStatus,
} from '@/types/database';

export type GoalInput = {
  title: string;
  description?: string | null;
  area: LifeAreaKey;
  target_date?: string | null;
};

export function useGoals(status: GoalStatus[] = ['active', 'paused']) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: [...queryKeys.goals(userId ?? 'anonymous'), status.join(',')],
    enabled: !!userId,
    queryFn: async (): Promise<GoalRow[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId!)
        .in('status', status)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGoal(goalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.goal(goalId ?? 'none'),
    enabled: !!goalId,
    queryFn: async (): Promise<GoalRow | null> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Completed-vs-total task counts per goal, used by the progress rings. */
export function useGoalProgress() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.goalProgress(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Record<string, GoalProgressRow>> => {
      const { data, error } = await supabase
        .from('goal_progress')
        .select('*')
        .eq('user_id', userId!);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.goal_id, row]));
    },
  });
}

export function useComponents(goalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.components(goalId ?? 'none'),
    enabled: !!goalId,
    queryFn: async (): Promise<GoalComponentRow[]> => {
      const { data, error } = await supabase
        .from('goal_components')
        .select('*')
        .eq('goal_id', goalId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useGoalInvalidation() {
  const { user } = useAuth();
  const client = useQueryClient();

  return (goalId?: string) => {
    if (user) {
      client.invalidateQueries({ queryKey: queryKeys.goals(user.id) });
      client.invalidateQueries({ queryKey: queryKeys.goalProgress(user.id) });
    }
    if (goalId) {
      client.invalidateQueries({ queryKey: queryKeys.goal(goalId) });
      client.invalidateQueries({ queryKey: queryKeys.components(goalId) });
    }
  };
}

export function useCreateGoal() {
  const { user } = useAuth();
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async (input: GoalInput) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          area: input.area,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          target_date: input.target_date ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (goal) => invalidate(goal.id),
  });
}

export function useUpdateGoal() {
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<GoalRow> }) => {
      const { data, error } = await supabase
        .from('goals')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (goal) => invalidate(goal.id),
  });
}

export function useDeleteGoal() {
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => invalidate(),
  });
}

export function useCreateComponent() {
  const { user } = useAuth();
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async ({ goalId, title }: { goalId: string; title: string }) => {
      if (!user) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('goal_components')
        .insert({ user_id: user.id, goal_id: goalId, title: title.trim() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (component) => invalidate(component.goal_id),
  });
}

export function useUpdateComponent() {
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; status?: ComponentStatus };
    }) => {
      const { data, error } = await supabase
        .from('goal_components')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (component) => invalidate(component.goal_id),
  });
}

export function useDeleteComponent() {
  const invalidate = useGoalInvalidation();

  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      const { error } = await supabase.from('goal_components').delete().eq('id', id);
      if (error) throw error;
      return goalId;
    },
    onSuccess: (goalId) => invalidate(goalId),
  });
}
