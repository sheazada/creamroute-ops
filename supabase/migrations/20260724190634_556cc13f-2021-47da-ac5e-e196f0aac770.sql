
CREATE TABLE public.gps_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  error_code TEXT,
  error_message TEXT,
  run_id UUID REFERENCES public.delivery_runs(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gps_audit_logs_run_idx ON public.gps_audit_logs(run_id, created_at DESC);
CREATE INDEX gps_audit_logs_delivery_idx ON public.gps_audit_logs(delivery_id, created_at DESC);
CREATE INDEX gps_audit_logs_created_idx ON public.gps_audit_logs(created_at DESC);

GRANT SELECT, INSERT ON public.gps_audit_logs TO authenticated;
GRANT ALL ON public.gps_audit_logs TO service_role;

ALTER TABLE public.gps_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view gps audit logs"
  ON public.gps_audit_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Team can insert gps audit logs"
  ON public.gps_audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins/managers can delete gps audit logs"
  ON public.gps_audit_logs FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );
