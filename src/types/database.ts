/**
 * Hand-maintained mirror of supabase/migrations. Regenerate with
 *   supabase gen types typescript --local > src/types/database.ts
 * after changing the schema.
 */
import type { LifeAreaKey } from '@/features/assessment/areas';
import type { Recurrence } from '@/features/tasks/recurrence';

export type GoalStatus = 'active' | 'paused' | 'done' | 'archived';
export type ComponentStatus = 'active' | 'done' | 'archived';
export type TaskStatus = 'active' | 'archived';
export type CompletionStatus = 'done' | 'skipped';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  locale: 'uz' | 'ru' | 'en';
  timezone: string;
  reassess_interval_days: number | null;
  last_assessment_at: string | null;
  next_reassess_at: string | null;
  reassess_snoozed_until: string | null;
  missed_lookback_days: number;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentRow = {
  id: string;
  user_id: string;
  taken_at: string;
  note: string | null;
  created_at: string;
};

export type AssessmentScoreRow = {
  assessment_id: string;
  user_id: string;
  area: LifeAreaKey;
  score: number;
};

export type GoalRow = {
  id: string;
  user_id: string;
  area: LifeAreaKey;
  title: string;
  description: string | null;
  target_date: string | null;
  status: GoalStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GoalComponentRow = {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  status: ComponentStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  user_id: string;
  goal_id: string | null;
  component_id: string | null;
  title: string;
  notes: string | null;
  due_date: string | null;
  starts_on: string | null;
  recurrence: Recurrence | null;
  status: TaskStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TaskCompletionRow = {
  id: string;
  user_id: string;
  task_id: string;
  occurrence_date: string;
  status: CompletionStatus;
  completed_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: 'reassessment_due';
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export type GoalProgressRow = {
  goal_id: string;
  user_id: string;
  total_tasks: number;
  done_tasks: number;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      assessments: Table<AssessmentRow, { user_id: string; note?: string | null }>;
      assessment_scores: Table<AssessmentScoreRow, AssessmentScoreRow>;
      goals: Table<
        GoalRow,
        Omit<GoalRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'sort_order'> & {
          id?: string;
          status?: GoalStatus;
          sort_order?: number;
        }
      >;
      goal_components: Table<
        GoalComponentRow,
        Omit<GoalComponentRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'sort_order'> & {
          id?: string;
          status?: ComponentStatus;
          sort_order?: number;
        }
      >;
      tasks: Table<
        TaskRow,
        Omit<TaskRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'sort_order'> & {
          id?: string;
          status?: TaskStatus;
          sort_order?: number;
        }
      >;
      task_completions: Table<
        TaskCompletionRow,
        Omit<TaskCompletionRow, 'id' | 'completed_at'> & {
          id?: string;
          completed_at?: string;
        }
      >;
      notifications: Table<NotificationRow>;
    };
    Views: {
      assessment_history: {
        Row: {
          assessment_id: string;
          user_id: string;
          taken_at: string;
          area: LifeAreaKey;
          score: number;
        };
        Relationships: [];
      };
      goal_progress: { Row: GoalProgressRow; Relationships: [] };
    };
    Functions: {
      save_assessment: {
        Args: { scores: Record<LifeAreaKey, number>; note?: string | null };
        Returns: string;
      };
    };
    Enums: {
      life_area: LifeAreaKey;
      goal_status: GoalStatus;
      component_status: ComponentStatus;
      task_status: TaskStatus;
      completion_status: CompletionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
