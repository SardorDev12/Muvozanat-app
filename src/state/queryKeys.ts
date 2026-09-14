import type { DateKey } from '@/utils/date';

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  assessments: (userId: string) => ['assessments', userId] as const,
  latestAssessment: (userId: string) => ['assessments', userId, 'latest'] as const,
  assessmentHistory: (userId: string) => ['assessments', userId, 'history'] as const,
  goals: (userId: string) => ['goals', userId] as const,
  goal: (goalId: string) => ['goal', goalId] as const,
  goalProgress: (userId: string) => ['goalProgress', userId] as const,
  components: (goalId: string) => ['components', goalId] as const,
  tasks: (userId: string) => ['tasks', userId] as const,
  tasksForGoal: (goalId: string) => ['tasks', 'goal', goalId] as const,
  completions: (userId: string, from: DateKey, to: DateKey) =>
    ['completions', userId, from, to] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
};
