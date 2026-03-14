
CREATE TABLE public.area_scheduled_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (area_id, day_of_week)
);

ALTER TABLE public.area_scheduled_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled days"
  ON public.area_scheduled_days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled days"
  ON public.area_scheduled_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled days"
  ON public.area_scheduled_days FOR DELETE
  USING (auth.uid() = user_id);
