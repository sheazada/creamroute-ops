
CREATE TABLE IF NOT EXISTS public.edit_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  route_id uuid,
  run_id uuid,
  delivery_id uuid,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edit_audit_logs TO authenticated;
GRANT ALL ON public.edit_audit_logs TO service_role;
ALTER TABLE public.edit_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read edit audit" ON public.edit_audit_logs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS edit_audit_route_created_idx ON public.edit_audit_logs(route_id, created_at);
CREATE INDEX IF NOT EXISTS edit_audit_run_idx ON public.edit_audit_logs(run_id);
CREATE INDEX IF NOT EXISTS edit_audit_delivery_idx ON public.edit_audit_logs(delivery_id);

-- Log field-level changes on delivery_runs
CREATE OR REPLACE FUNCTION public.log_delivery_run_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f text; old_v text; new_v text; uid uuid;
  fields text[] := ARRAY['driver_name','helper_name','vehicle_number','vehicle_type',
    'odometer_start','odometer_end','started_at','ended_at','pickup_confirmed_at',
    'status','delivery_status','notes'];
BEGIN
  uid := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, run_id, action, changed_by)
    VALUES ('delivery_run', NEW.id, NEW.route_id, NEW.id, 'created', uid);
    RETURN NEW;
  END IF;
  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, run_id, action, field, old_value, new_value, changed_by)
      VALUES ('delivery_run', NEW.id, NEW.route_id, NEW.id, 'updated', f, old_v, new_v, uid);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_delivery_run_changes ON public.delivery_runs;
CREATE TRIGGER trg_log_delivery_run_changes
AFTER INSERT OR UPDATE ON public.delivery_runs
FOR EACH ROW EXECUTE FUNCTION public.log_delivery_run_changes();

-- Log field-level changes on deliveries
CREATE OR REPLACE FUNCTION public.log_delivery_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f text; old_v text; new_v text; uid uuid;
  fields text[] := ARRAY['status','delivered_at','received_by','collected_amount',
    'collected_mode','route_id','assigned_to','notes','scheduled_date',
    'pod_photo_url','pod_signature'];
BEGIN
  uid := auth.uid();
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, delivery_id, action, field, old_value, new_value, changed_by)
      VALUES ('delivery', NEW.id, NEW.route_id, NEW.id, 'updated', f, old_v, new_v, uid);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_delivery_changes ON public.deliveries;
CREATE TRIGGER trg_log_delivery_changes
AFTER UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.log_delivery_changes();
