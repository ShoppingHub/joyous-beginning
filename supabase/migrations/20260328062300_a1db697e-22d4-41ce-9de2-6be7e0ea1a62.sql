
-- Diet programs
CREATE TABLE public.diet_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Diet Plan',
  mode TEXT NOT NULL DEFAULT 'choice',
  free_meals_per_week INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.diet_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own diet programs" ON public.diet_programs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own diet programs" ON public.diet_programs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own diet programs" ON public.diet_programs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own diet programs" ON public.diet_programs FOR DELETE USING (auth.uid() = user_id);

-- Diet program meals
CREATE TABLE public.diet_program_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.diet_programs(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner')),
  active BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.diet_program_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their diet meals" ON public.diet_program_meals FOR SELECT USING (EXISTS (SELECT 1 FROM public.diet_programs p WHERE p.id = diet_program_meals.program_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert their diet meals" ON public.diet_program_meals FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.diet_programs p WHERE p.id = diet_program_meals.program_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their diet meals" ON public.diet_program_meals FOR UPDATE USING (EXISTS (SELECT 1 FROM public.diet_programs p WHERE p.id = diet_program_meals.program_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete their diet meals" ON public.diet_program_meals FOR DELETE USING (EXISTS (SELECT 1 FROM public.diet_programs p WHERE p.id = diet_program_meals.program_id AND p.user_id = auth.uid()));

-- Diet meal items
CREATE TABLE public.diet_meal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES public.diet_program_meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_per_week INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.diet_meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their diet items" ON public.diet_meal_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.diet_program_meals m JOIN public.diet_programs p ON p.id = m.program_id WHERE m.id = diet_meal_items.meal_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can insert their diet items" ON public.diet_meal_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.diet_program_meals m JOIN public.diet_programs p ON p.id = m.program_id WHERE m.id = diet_meal_items.meal_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update their diet items" ON public.diet_meal_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.diet_program_meals m JOIN public.diet_programs p ON p.id = m.program_id WHERE m.id = diet_meal_items.meal_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete their diet items" ON public.diet_meal_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.diet_program_meals m JOIN public.diet_programs p ON p.id = m.program_id WHERE m.id = diet_meal_items.meal_id AND p.user_id = auth.uid()));

-- Diet sessions
CREATE TABLE public.diet_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(area_id, date)
);
ALTER TABLE public.diet_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their diet sessions" ON public.diet_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their diet sessions" ON public.diet_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their diet sessions" ON public.diet_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their diet sessions" ON public.diet_sessions FOR DELETE USING (auth.uid() = user_id);

-- Diet session meals
CREATE TABLE public.diet_session_meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.diet_sessions(id) ON DELETE CASCADE,
  program_meal_id UUID NOT NULL REFERENCES public.diet_program_meals(id),
  completed BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.diet_session_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their diet session meals" ON public.diet_session_meals FOR SELECT USING (EXISTS (SELECT 1 FROM public.diet_sessions s WHERE s.id = diet_session_meals.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert their diet session meals" ON public.diet_session_meals FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.diet_sessions s WHERE s.id = diet_session_meals.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can update their diet session meals" ON public.diet_session_meals FOR UPDATE USING (EXISTS (SELECT 1 FROM public.diet_sessions s WHERE s.id = diet_session_meals.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete their diet session meals" ON public.diet_session_meals FOR DELETE USING (EXISTS (SELECT 1 FROM public.diet_sessions s WHERE s.id = diet_session_meals.session_id AND s.user_id = auth.uid()));

-- Diet session items
CREATE TABLE public.diet_session_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_meal_id UUID NOT NULL REFERENCES public.diet_session_meals(id) ON DELETE CASCADE,
  meal_item_id UUID NOT NULL REFERENCES public.diet_meal_items(id),
  consumed BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.diet_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their diet session items" ON public.diet_session_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.diet_session_meals sm JOIN public.diet_sessions s ON s.id = sm.session_id WHERE sm.id = diet_session_items.session_meal_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert their diet session items" ON public.diet_session_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.diet_session_meals sm JOIN public.diet_sessions s ON s.id = sm.session_id WHERE sm.id = diet_session_items.session_meal_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can update their diet session items" ON public.diet_session_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.diet_session_meals sm JOIN public.diet_sessions s ON s.id = sm.session_id WHERE sm.id = diet_session_items.session_meal_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete their diet session items" ON public.diet_session_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.diet_session_meals sm JOIN public.diet_sessions s ON s.id = sm.session_id WHERE sm.id = diet_session_items.session_meal_id AND s.user_id = auth.uid()));
