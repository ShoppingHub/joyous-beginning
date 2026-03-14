
-- Add unique constraint on score_daily(area_id, date) for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'score_daily_area_id_date_key'
  ) THEN
    ALTER TABLE public.score_daily ADD CONSTRAINT score_daily_area_id_date_key UNIQUE (area_id, date);
  END IF;
END $$;
