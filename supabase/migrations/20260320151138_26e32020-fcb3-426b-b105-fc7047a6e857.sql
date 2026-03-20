
ALTER TABLE public.gym_program_exercises 
  ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS duration_minutes numeric NULL,
  ADD COLUMN IF NOT EXISTS intensity numeric NULL;

ALTER TABLE public.gym_session_exercises
  ADD COLUMN IF NOT EXISTS duration_used numeric NULL,
  ADD COLUMN IF NOT EXISTS intensity_used numeric NULL;
