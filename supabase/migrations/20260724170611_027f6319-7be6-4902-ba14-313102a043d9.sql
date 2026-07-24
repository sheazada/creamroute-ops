
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text,
  driver_name text,
  helper_name text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_all" ON public.routes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER routes_updated BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, customer_id)
);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id, sequence);
CREATE INDEX idx_route_stops_customer ON public.route_stops(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "route_stops_all" ON public.route_stops FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER route_stops_updated BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.deliveries ADD COLUMN route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL;
CREATE INDEX idx_deliveries_route ON public.deliveries(route_id);
