
-- Lock down share_activity_logs: admin-only reads, authenticated inserts tied to own user, no updates/deletes.
ALTER TABLE public.share_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_activity_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view all share activity" ON public.share_activity_logs;
DROP POLICY IF EXISTS "Users can view their own share activity" ON public.share_activity_logs;
DROP POLICY IF EXISTS "Anyone signed in can log share activity" ON public.share_activity_logs;
DROP POLICY IF EXISTS "Admins can view all share activity" ON public.share_activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own share activity" ON public.share_activity_logs;

-- Revoke update/delete so no one (except service_role) can modify or remove audit rows.
REVOKE ALL ON public.share_activity_logs FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON public.share_activity_logs TO authenticated;
GRANT ALL ON public.share_activity_logs TO service_role;

-- Admin-only read access.
CREATE POLICY "Admins can view all share activity"
  ON public.share_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Any signed-in user may append a log entry, but only tied to their own user_id.
CREATE POLICY "Authenticated users can insert own share activity"
  ON public.share_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE / DELETE policies => append-only under RLS (FORCE applies to table owner too).
