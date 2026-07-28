-- Access audit log: records every login attempt and every denied page access.
-- Separate from business audit_logs so security events are easy to query.

CREATE TABLE IF NOT EXISTS public.access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success',
    'login_failure',
    'logout',
    'access_denied'
  )),
  user_id UUID,
  user_email TEXT,
  user_roles TEXT[],               -- roles the user had at the time
  required_roles TEXT[],           -- roles required by the route
  route_path TEXT,                 -- the path they tried to open
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,                     -- why access was denied (for access_denied events)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_access_audit_user
  ON public.access_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_event
  ON public.access_audit_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_route
  ON public.access_audit_logs (route_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_time
  ON public.access_audit_logs (created_at DESC);

-- Row-level security: anyone authenticated can read (so admin can view them).
ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_audit_logs_select" ON public.access_audit_logs;
DROP POLICY IF EXISTS "access_audit_logs_insert" ON public.access_audit_logs;

CREATE POLICY "access_audit_logs_select"
  ON public.access_audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "access_audit_logs_insert"
  ON public.access_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Helper function: write an audit row. Called from server functions.
-- Runs as SECURITY DEFINER so any authenticated caller can log events.
CREATE OR REPLACE FUNCTION public.log_access_event(
  _event_type TEXT,
  _user_id UUID,
  _user_email TEXT,
  _user_roles TEXT[],
  _required_roles TEXT[],
  _route_path TEXT,
  _ip_address TEXT,
  _user_agent TEXT,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.access_audit_logs (
    event_type,
    user_id,
    user_email,
    user_roles,
    required_roles,
    route_path,
    ip_address,
    user_agent,
    reason
  ) VALUES (
    _event_type,
    _user_id,
    _user_email,
    _user_roles,
    _required_roles,
    _route_path,
    _ip_address,
    _user_agent,
    _reason
  );
END;
$$;
