
-- Create user_cards table
CREATE TABLE public.user_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('gym', 'finance_projection')),
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_type)
);

-- Enable RLS
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own cards" ON public.user_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON public.user_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON public.user_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON public.user_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Migrate data: finance_projection from extra_tab_enabled
INSERT INTO public.user_cards (user_id, card_type, area_id, enabled)
SELECT 
  u.user_id,
  'finance_projection',
  (SELECT a.id FROM public.areas a WHERE a.user_id = u.user_id AND a.type = 'finance' AND a.archived_at IS NULL ORDER BY a.created_at LIMIT 1),
  true
FROM public.users u
WHERE u.extra_tab_enabled = true
ON CONFLICT (user_id, card_type) DO NOTHING;

-- Migrate data: gym from health areas matching gym/palestra
INSERT INTO public.user_cards (user_id, card_type, area_id, enabled)
SELECT 
  a.user_id,
  'gym',
  a.id,
  true
FROM public.areas a
WHERE a.type = 'health' AND a.archived_at IS NULL AND a.name ~* '(gym|palestra)'
ON CONFLICT (user_id, card_type) DO NOTHING;

-- Drop extra_tab_enabled column
ALTER TABLE public.users DROP COLUMN IF EXISTS extra_tab_enabled;
