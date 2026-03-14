
-- Gym sessions table
CREATE TABLE public.gym_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (area_id, date)
);

ALTER TABLE public.gym_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gym sessions" ON public.gym_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gym sessions" ON public.gym_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gym sessions" ON public.gym_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Gym exercises table
CREATE TABLE public.gym_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.gym_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg DECIMAL,
  notes TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their gym exercises" ON public.gym_exercises FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.gym_sessions WHERE gym_sessions.id = gym_exercises.session_id AND gym_sessions.user_id = auth.uid()));
CREATE POLICY "Users can insert their gym exercises" ON public.gym_exercises FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.gym_sessions WHERE gym_sessions.id = gym_exercises.session_id AND gym_sessions.user_id = auth.uid()));
CREATE POLICY "Users can update their gym exercises" ON public.gym_exercises FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.gym_sessions WHERE gym_sessions.id = gym_exercises.session_id AND gym_sessions.user_id = auth.uid()));
CREATE POLICY "Users can delete their gym exercises" ON public.gym_exercises FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.gym_sessions WHERE gym_sessions.id = gym_exercises.session_id AND gym_sessions.user_id = auth.uid()));
