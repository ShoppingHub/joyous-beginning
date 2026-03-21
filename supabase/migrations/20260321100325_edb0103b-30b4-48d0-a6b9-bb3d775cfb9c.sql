
-- Add recurrence_type to areas (weekly is default, backward compatible)
ALTER TABLE public.areas 
  ADD COLUMN recurrence_type text NOT NULL DEFAULT 'weekly',
  ADD COLUMN biweekly_start_date date;

-- Table for monthly day selections (e.g. 1st, 15th of month)
CREATE TABLE public.area_monthly_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  day_of_month integer NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, day_of_month)
);

ALTER TABLE public.area_monthly_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly days"
  ON public.area_monthly_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly days"
  ON public.area_monthly_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly days"
  ON public.area_monthly_days FOR DELETE
  USING (auth.uid() = user_id);
