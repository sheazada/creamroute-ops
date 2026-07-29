-- App Settings table for storing VAPID keys and other configuration
-- Used by the browser push notification system

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role (server-side) can read/write settings
-- Authenticated users cannot directly access VAPID private keys
DROP POLICY IF EXISTS "app_settings_select_admin" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_insert_admin" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;

-- Public read for non-sensitive settings (VAPID public key is safe to expose)
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

-- Only service role can insert/update (no authenticated user policy for write)
-- The VAPID private key must never be accessible from client-side

-- Insert VAPID keys
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('vapid_public_key', 'BLdJdq0AZpnIG6E0fGEEeKze3IWcKaX1iz7Ih92hwq19US-qsw_jc4UCBS2OpqA9sa0wcc0Pt2LVAufHn9k88Qk', 'VAPID public key for browser push notifications'),
  ('vapid_private_key', 'Fnr2bH7JJwGK6hGWvKay6w6A97p0xp--Wnw3cKIOHNI', 'VAPID private key for browser push notifications (server-side only)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Helper function to get a setting value
CREATE OR REPLACE FUNCTION public.get_app_setting(_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT value FROM public.app_settings WHERE key = _key LIMIT 1;
$$;
