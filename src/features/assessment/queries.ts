import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/state/queryKeys';

import { LIFE_AREA_KEYS, defaultScores, type LifeAreaKey, type WheelScores } from './areas';

export type AssessmentSnapshot = {
  id: string;
  takenAt: string;
  scores: WheelScores;
};

function rowsToSnapshots(
  rows: { assessment_id: string; taken_at: string; area: LifeAreaKey; score: number }[],
): AssessmentSnapshot[] {
  const byId = new Map<string, AssessmentSnapshot>();

  for (const row of rows) {
    let snapshot = byId.get(row.assessment_id);
    if (!snapshot) {
      snapshot = { id: row.assessment_id, takenAt: row.taken_at, scores: defaultScores() };
      byId.set(row.assessment_id, snapshot);
    }
    snapshot.scores[row.area] = row.score;
  }

  return [...byId.values()].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Every assessment the user has taken, oldest first, for the trend chart. */
export function useAssessmentHistory() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.assessmentHistory(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<AssessmentSnapshot[]> => {
      const { data, error } = await supabase
        .from('assessment_history')
        .select('assessment_id, taken_at, area, score')
        .eq('user_id', userId!)
        .order('taken_at', { ascending: true });
      if (error) throw error;
      return rowsToSnapshots(data ?? []);
    },
  });
}

export function useLatestAssessment() {
  const history = useAssessmentHistory();
  const snapshots = history.data ?? [];
  return {
    ...history,
    data: snapshots.length > 0 ? snapshots[snapshots.length - 1] : null,
    previous: snapshots.length > 1 ? snapshots[snapshots.length - 2] : null,
  };
}

export function useSaveAssessment() {
  const { user } = useAuth();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ scores, note }: { scores: WheelScores; note?: string }) => {
      if (!user) throw new Error('Not signed in');

      // Guard against a partially-filled object reaching the RPC, which would
      // fail server-side with a less obvious message.
      for (const key of LIFE_AREA_KEYS) {
        const value = scores[key];
        if (!Number.isInteger(value) || value < 1 || value > 10) {
          throw new Error(`Invalid score for ${key}: ${value}`);
        }
      }

      const { data, error } = await supabase.rpc('save_assessment', {
        scores,
        note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!user) return;
      client.invalidateQueries({ queryKey: queryKeys.assessmentHistory(user.id) });
      client.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
    },
  });
}
