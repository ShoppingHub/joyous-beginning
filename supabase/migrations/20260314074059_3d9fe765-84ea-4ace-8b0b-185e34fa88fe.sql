
-- Add tracking columns to areas table
ALTER TABLE public.areas 
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'binary',
  ADD COLUMN IF NOT EXISTS unit_label text,
  ADD COLUMN IF NOT EXISTS baseline_initial integer,
  ADD COLUMN IF NOT EXISTS show_quick_add_home boolean NOT NULL DEFAULT true;

-- Create habit_quantity_daily table
CREATE TABLE public.habit_quantity_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  date date NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'quick_add' CHECK (source IN ('quick_add', 'manual_edit', 'system_init')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(area_id, date)
);

-- Enable RLS
ALTER TABLE public.habit_quantity_daily ENABLE ROW LEVEL SECURITY;

-- RLS policies for habit_quantity_daily
CREATE POLICY "Users can view their own quantity records" ON public.habit_quantity_daily
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.areas WHERE areas.id = habit_quantity_daily.area_id AND areas.user_id = auth.uid()));

CREATE POLICY "Users can insert their own quantity records" ON public.habit_quantity_daily
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.areas WHERE areas.id = habit_quantity_daily.area_id AND areas.user_id = auth.uid()));

CREATE POLICY "Users can update their own quantity records" ON public.habit_quantity_daily
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.areas WHERE areas.id = habit_quantity_daily.area_id AND areas.user_id = auth.uid()));

CREATE POLICY "Users can delete their own quantity records" ON public.habit_quantity_daily
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.areas WHERE areas.id = habit_quantity_daily.area_id AND areas.user_id = auth.uid()));
