
-- Drop old tables
DROP TABLE IF EXISTS public.gym_exercises CASCADE;
DROP TABLE IF EXISTS public.gym_sessions CASCADE;

-- gym_programs: one program per gym area
CREATE TABLE public.gym_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area_id)
);
ALTER TABLE public.gym_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own gym programs" ON public.gym_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gym programs" ON public.gym_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gym programs" ON public.gym_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gym programs" ON public.gym_programs FOR DELETE USING (auth.uid() = user_id);

-- gym_program_days: training days in a program
CREATE TABLE public.gym_program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.gym_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gym_program_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their program days" ON public.gym_program_days FOR SELECT USING (EXISTS (SELECT 1 FROM public.gym_programs WHERE gym_programs.id = gym_program_days.program_id AND gym_programs.user_id = auth.uid()));
CREATE POLICY "Users can insert their program days" ON public.gym_program_days FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gym_programs WHERE gym_programs.id = gym_program_days.program_id AND gym_programs.user_id = auth.uid()));
CREATE POLICY "Users can update their program days" ON public.gym_program_days FOR UPDATE USING (EXISTS (SELECT 1 FROM public.gym_programs WHERE gym_programs.id = gym_program_days.program_id AND gym_programs.user_id = auth.uid()));
CREATE POLICY "Users can delete their program days" ON public.gym_program_days FOR DELETE USING (EXISTS (SELECT 1 FROM public.gym_programs WHERE gym_programs.id = gym_program_days.program_id AND gym_programs.user_id = auth.uid()));

-- gym_muscle_groups: muscle groups per day
CREATE TABLE public.gym_muscle_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.gym_program_days(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gym_muscle_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their muscle groups" ON public.gym_muscle_groups FOR SELECT USING (EXISTS (SELECT 1 FROM public.gym_program_days d JOIN public.gym_programs p ON p.id = d.program_id WHERE d.id = gym_muscle_groups.day_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert their muscle groups" ON public.gym_muscle_groups FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gym_program_days d JOIN public.gym_programs p ON p.id = d.program_id WHERE d.id = gym_muscle_groups.day_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their muscle groups" ON public.gym_muscle_groups FOR UPDATE USING (EXISTS (SELECT 1 FROM public.gym_program_days d JOIN public.gym_programs p ON p.id = d.program_id WHERE d.id = gym_muscle_groups.day_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete their muscle groups" ON public.gym_muscle_groups FOR DELETE USING (EXISTS (SELECT 1 FROM public.gym_program_days d JOIN public.gym_programs p ON p.id = d.program_id WHERE d.id = gym_muscle_groups.day_id AND p.user_id = auth.uid()));

-- gym_program_exercises: exercises in a muscle group
CREATE TABLE public.gym_program_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.gym_muscle_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  sets integer NOT NULL,
  reps integer NOT NULL,
  default_weight numeric,
  is_daily boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gym_program_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their program exercises" ON public.gym_program_exercises FOR SELECT USING (EXISTS (SELECT 1 FROM public.gym_muscle_groups g JOIN public.gym_program_days d ON d.id = g.day_id JOIN public.gym_programs p ON p.id = d.program_id WHERE g.id = gym_program_exercises.group_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert their program exercises" ON public.gym_program_exercises FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gym_muscle_groups g JOIN public.gym_program_days d ON d.id = g.day_id JOIN public.gym_programs p ON p.id = d.program_id WHERE g.id = gym_program_exercises.group_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their program exercises" ON public.gym_program_exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM public.gym_muscle_groups g JOIN public.gym_program_days d ON d.id = g.day_id JOIN public.gym_programs p ON p.id = d.program_id WHERE g.id = gym_program_exercises.group_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete their program exercises" ON public.gym_program_exercises FOR DELETE USING (EXISTS (SELECT 1 FROM public.gym_muscle_groups g JOIN public.gym_program_days d ON d.id = g.day_id JOIN public.gym_programs p ON p.id = d.program_id WHERE g.id = gym_program_exercises.group_id AND p.user_id = auth.uid()));

-- gym_sessions: daily session linked to a program day
CREATE TABLE public.gym_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  day_id uuid NOT NULL REFERENCES public.gym_program_days(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area_id, date)
);
ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own gym sessions" ON public.gym_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gym sessions" ON public.gym_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gym sessions" ON public.gym_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gym sessions" ON public.gym_sessions FOR DELETE USING (auth.uid() = user_id);

-- gym_session_exercises: completed exercises in a session
CREATE TABLE public.gym_session_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.gym_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.gym_program_exercises(id) ON DELETE CASCADE,
  weight_used numeric,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, exercise_id)
);
ALTER TABLE public.gym_session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their session exercises" ON public.gym_session_exercises FOR SELECT USING (EXISTS (SELECT 1 FROM public.gym_sessions s WHERE s.id = gym_session_exercises.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert their session exercises" ON public.gym_session_exercises FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.gym_sessions s WHERE s.id = gym_session_exercises.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can update their session exercises" ON public.gym_session_exercises FOR UPDATE USING (EXISTS (SELECT 1 FROM public.gym_sessions s WHERE s.id = gym_session_exercises.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete their session exercises" ON public.gym_session_exercises FOR DELETE USING (EXISTS (SELECT 1 FROM public.gym_sessions s WHERE s.id = gym_session_exercises.session_id AND s.user_id = auth.uid()));
