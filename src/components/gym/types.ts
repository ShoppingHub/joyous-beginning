export interface GymProgram {
  id: string;
  area_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface GymProgramDay {
  id: string;
  program_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface GymMuscleGroup {
  id: string;
  day_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface GymProgramExercise {
  id: string;
  group_id: string;
  name: string;
  sets: number;
  reps: number;
  default_weight: number | null;
  is_daily: boolean;
  active: boolean;
  order: number;
  created_at: string;
}

export interface GymSession {
  id: string;
  area_id: string;
  user_id: string;
  day_id: string;
  date: string;
  created_at: string;
}

export interface GymSessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  weight_used: number | null;
  completed: boolean;
  created_at: string;
}
