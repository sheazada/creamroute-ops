CREATE TABLE IF NOT EXISTS public.access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success','login_failure','logout','access_denied')),
  user_id UUID,
  user_email TEXT,
  user_roles TEXT[],
  required_roles TEXT[],
  route_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.access_audit_logs TO authenticated;
GRANT ALL ON public.access_audit_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_access_audit_user ON public.access_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_event ON public.access_audit_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_route ON public.access_audit_logs (route_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_time ON public.access_audit_logs (created_at DESC);

ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_audit_logs_select" ON public.access_audit_logs;
DROP POLICY IF EXISTS "access_audit_logs_insert" ON public.access_audit_logs;

CREATE POLICY "access_audit_logs_select"
  ON public.access_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "access_audit_logs_insert"
  ON public.access_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

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
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.access_audit_logs (
    event_type, user_id, user_email, user_roles, required_roles,
    route_path, ip_address, user_agent, reason
  ) VALUES (
    _event_type, _user_id, _user_email, _user_roles, _required_roles,
    _route_path, _ip_address, _user_agent, _reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_access_event(TEXT,UUID,TEXT,TEXT[],TEXT[],TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_access_event(TEXT,UUID,TEXT,TEXT[],TEXT[],TEXT,TEXT,TEXT,TEXT) TO authenticated, service_role;