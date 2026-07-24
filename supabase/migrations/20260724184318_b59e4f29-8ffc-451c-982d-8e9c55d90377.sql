
ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'planned';

CREATE OR REPLACE FUNCTION public.recalc_run_delivery_status(_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_route uuid;
  v_date  date;
  v_run_status text;
  v_total int := 0;
  v_delivered int := 0;
  v_partial int := 0;
  v_failed int := 0;
  v_en_route int := 0;
  v_status text;
BEGIN
  SELECT route_id, run_date, status INTO v_route, v_date, v_run_status
    FROM public.delivery_runs WHERE id = _run_id;
  IF v_route IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'partially_delivered'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'en_route')
  INTO v_total, v_delivered, v_partial, v_failed, v_en_route
  FROM public.deliveries
  WHERE route_id = v_route
    AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = v_date;

  IF v_total = 0 THEN
    v_status := CASE WHEN v_run_status = 'in_progress' THEN 'en_route'
                     WHEN v_run_status = 'completed' THEN 'delivered'
                     ELSE 'planned' END;
  ELSIF v_delivered = v_total THEN
    v_status := 'delivered';
  ELSIF (v_delivered + v_partial + v_failed) = v_total THEN
    v_status := CASE WHEN v_failed = v_total THEN 'failed' ELSE 'partially_delivered' END;
  ELSIF v_en_route > 0 OR v_delivered > 0 OR v_partial > 0 OR v_failed > 0 OR v_run_status = 'in_progress' THEN
    v_status := 'en_route';
  ELSE
    v_status := 'planned';
  END IF;

  UPDATE public.delivery_runs SET delivery_status = v_status WHERE id = _run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_runs_recalc_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_run_delivery_status(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_runs_recalc_status ON public.delivery_runs;
CREATE TRIGGER delivery_runs_recalc_status
AFTER INSERT OR UPDATE OF status, run_date, route_id ON public.delivery_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_runs_recalc_delivery_status();

CREATE OR REPLACE FUNCTION public.tg_deliveries_recalc_run_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
  run_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT route_id, COALESCE(scheduled_date, delivered_at::date, created_at::date) AS d
    FROM (
      SELECT (CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END) AS route_id,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.scheduled_date ELSE NEW.scheduled_date END) AS scheduled_date,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.delivered_at ELSE NEW.delivered_at END) AS delivered_at,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.created_at ELSE NEW.created_at END) AS created_at
      UNION ALL
      SELECT OLD.route_id, OLD.scheduled_date, OLD.delivered_at, OLD.created_at
      WHERE TG_OP = 'UPDATE'
    ) x
    WHERE route_id IS NOT NULL
  LOOP
    SELECT id INTO run_id FROM public.delivery_runs
      WHERE route_id = r.route_id AND run_date = r.d
      ORDER BY created_at DESC LIMIT 1;
    IF run_id IS NOT NULL THEN
      PERFORM public.recalc_run_delivery_status(run_id);
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS deliveries_recalc_run_status ON public.deliveries;
CREATE TRIGGER deliveries_recalc_run_status
AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.tg_deliveries_recalc_run_status();

-- Backfill existing runs
DO $$
DECLARE rid uuid;
BEGIN
  FOR rid IN SELECT id FROM public.delivery_runs LOOP
    PERFORM public.recalc_run_delivery_status(rid);
  END LOOP;
END $$;
