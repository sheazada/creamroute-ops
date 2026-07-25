CREATE TABLE public.share_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_no TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.share_activity_logs TO authenticated;
GRANT ALL ON public.share_activity_logs TO service_role;

ALTER TABLE public.share_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can log share activity"
  ON public.share_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins and managers can view all share activity"
  ON public.share_activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view their own share activity"
  ON public.share_activity_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_share_activity_logs_invoice ON public.share_activity_logs(invoice_id, created_at DESC);
CREATE INDEX idx_share_activity_logs_created ON public.share_activity_logs(created_at DESC);
CREATE INDEX idx_share_activity_logs_user ON public.share_activity_logs(user_id, created_at DESC);