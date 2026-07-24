
CREATE OR REPLACE FUNCTION public.enqueue_run_en_route_notifications(_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  d record;
  c record;
  inv record;
  payload jsonb;
  subject text;
  body text;
  ikey text;
  phone_e164 text;
  wa_e164 text;
  inserted int := 0;
BEGIN
  SELECT id, route_id, run_date, driver_name, vehicle_number
    INTO r FROM public.delivery_runs WHERE id = _run_id;
  IF NOT FOUND OR r.route_id IS NULL THEN RETURN 0; END IF;

  FOR d IN
    SELECT * FROM public.deliveries
     WHERE route_id = r.route_id
       AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = r.run_date
  LOOP
    SELECT * INTO inv FROM public.invoices WHERE id = d.invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO c FROM public.customers WHERE id = inv.customer_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    payload := jsonb_build_object(
      'shop_name', COALESCE(c.shop_name, c.name),
      'customer_name', c.name,
      'invoice_no', inv.invoice_no,
      'invoice_total', inv.total,
      'invoice_balance', inv.balance,
      'outstanding', c.outstanding,
      'status', 'en_route',
      'status_label', 'Out for delivery',
      'driver_name', r.driver_name,
      'vehicle_number', r.vehicle_number,
      'run_date', r.run_date
    );
    subject := format('Out for delivery · Invoice %s', inv.invoice_no);
    body := format(
      E'Hi %s,\nYour order (invoice %s, ₹%s) is out for delivery today%s.\nThank you.',
      COALESCE(c.shop_name, c.name),
      inv.invoice_no,
      to_char(COALESCE(inv.total,0), 'FM999999990.00'),
      CASE WHEN r.driver_name IS NOT NULL THEN ' with '||r.driver_name ELSE '' END
    );

    IF COALESCE(c.notify_email, true) AND c.email IS NOT NULL AND c.email <> '' THEN
      ikey := format('run:%s:en_route:%s:email', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'email', c.email, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;

    phone_e164 := NULLIF(regexp_replace(COALESCE(c.phone,''), '\s|-', '', 'g'), '');
    IF COALESCE(c.notify_sms, true) AND phone_e164 IS NOT NULL THEN
      ikey := format('run:%s:en_route:%s:sms', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'sms', phone_e164, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;

    wa_e164 := NULLIF(regexp_replace(COALESCE(c.whatsapp, c.phone,''), '\s|-', '', 'g'), '');
    IF COALESCE(c.notify_whatsapp, true) AND wa_e164 IS NOT NULL THEN
      ikey := format('run:%s:en_route:%s:whatsapp', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'whatsapp', wa_e164, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_runs_enqueue_status_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF NEW.delivery_status IS NULL
     OR NEW.delivery_status = 'planned'
     OR OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_status = 'en_route' THEN
    PERFORM public.enqueue_run_en_route_notifications(NEW.id);
  ELSIF NEW.delivery_status IN ('delivered','partially_delivered','failed') THEN
    -- Per-delivery notifications; enqueue_delivery_notifications() itself
    -- only enqueues rows for deliveries in terminal states and uses
    -- delivery:{id}:{status}:{channel} idempotency keys.
    FOR d IN
      SELECT id FROM public.deliveries
       WHERE route_id = NEW.route_id
         AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = NEW.run_date
    LOOP
      PERFORM public.enqueue_delivery_notifications(d.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_runs_enqueue_notifications ON public.delivery_runs;
CREATE TRIGGER delivery_runs_enqueue_notifications
AFTER UPDATE OF delivery_status ON public.delivery_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_runs_enqueue_status_notifications();
