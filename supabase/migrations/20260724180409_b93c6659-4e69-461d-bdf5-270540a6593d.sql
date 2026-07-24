
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS vehicle_type text;

CREATE TABLE IF NOT EXISTS public.delivery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  driver_name text,
  helper_name text,
  vehicle_number text,
  vehicle_type text,
  odometer_start numeric,
  odometer_end numeric,
  started_at timestamptz,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_runs TO authenticated;
GRANT ALL ON public.delivery_runs TO service_role;

ALTER TABLE public.delivery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_runs_all" ON public.delivery_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS delivery_runs_route_date_idx
  ON public.delivery_runs (route_id, run_date DESC);

CREATE TRIGGER delivery_runs_updated
  BEFORE UPDATE ON public.delivery_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
