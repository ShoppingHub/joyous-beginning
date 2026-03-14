
-- Add unique constraint on checkins(area_id, date) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkins_area_id_date_key'
  ) THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_area_id_date_key UNIQUE (area_id, date);
  END IF;
END $$;

-- Ensure handle_new_user trigger exists on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
