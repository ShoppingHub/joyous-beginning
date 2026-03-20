
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plus_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plus_activated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plus_expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plus_provider text DEFAULT NULL CHECK (plus_provider IN ('stripe', 'apple', 'google', 'manual'));
