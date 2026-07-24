
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE OR REPLACE FUNCTION public.enqueue_delivery_notifications(_delivery_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  c record;
  inv record;
  items_json jsonb;
  payload jsonb;
  subject text;
  body text;
  inserted int := 0;
  status_label text;
  ikey text;
  phone_e164 text;
  wa_e164 text;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = _delivery_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF d.status IS NULL OR d.status IN ('planned','en_route') THEN
    -- only enqueue on terminal delivery outcomes
    RETURN 0;
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = d.invoice_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO c FROM public.customers WHERE id = inv.customer_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', product_name,
      'ordered', COALESCE(ordered_quantity, quantity),
      'delivered', COALESCE(delivered_quantity, quantity),
      'rate', rate,
      'amount', amount
    ) ORDER BY product_name), '[]'::jsonb)
    INTO items_json
    FROM public.invoice_items WHERE invoice_id = inv.id;

  status_label := CASE d.status
    WHEN 'delivered' THEN 'Delivered'
    WHEN 'partially_delivered' THEN 'Partially delivered'
    WHEN 'failed' THEN 'Delivery failed'
    ELSE initcap(replace(d.status::text,'_',' '))
  END;

  payload := jsonb_build_object(
    'shop_name', COALESCE(c.shop_name, c.name),
    'customer_name', c.name,
    'invoice_no', inv.invoice_no,
    'invoice_total', inv.total,
    'invoice_balance', inv.balance,
    'outstanding', c.outstanding,
    'status', d.status,
    'status_label', status_label,
    'delivered_at', d.delivered_at,
    'collected_amount', COALESCE(d.collected_amount, 0),
    'collected_mode', d.collected_mode,
    'received_by', d.received_by,
    'items', items_json
  );

  subject := format('%s · Invoice %s', status_label, inv.invoice_no);

  body := format(
    E'Hi %s,\n\n%s for invoice %s (₹%s).\nCollected: ₹%s%s.\nOutstanding balance: ₹%s.\n\nThank you.',
    COALESCE(c.shop_name, c.name),
    status_label,
    inv.invoice_no,
    to_char(COALESCE(inv.total,0), 'FM999999990.00'),
    to_char(COALESCE(d.collected_amount,0), 'FM999999990.00'),
    CASE WHEN d.collected_mode IS NOT NULL THEN ' ('||d.collected_mode||')' ELSE '' END,
    to_char(COALESCE(c.outstanding,0), 'FM999999990.00')
  );

  -- Idempotency: one row per delivery+status+channel. Re-saves that change status enqueue a fresh row.
  -- EMAIL
  IF COALESCE(c.notify_email, true) AND c.email IS NOT NULL AND c.email <> '' THEN
    ikey := format('delivery:%s:%s:email', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'email', c.email, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  -- SMS
  phone_e164 := NULLIF(regexp_replace(COALESCE(c.phone,''), '\s|-', '', 'g'), '');
  IF COALESCE(c.notify_sms, true) AND phone_e164 IS NOT NULL THEN
    ikey := format('delivery:%s:%s:sms', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'sms', phone_e164, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  -- WHATSAPP
  wa_e164 := NULLIF(regexp_replace(COALESCE(c.whatsapp, c.phone,''), '\s|-', '', 'g'), '');
  IF COALESCE(c.notify_whatsapp, true) AND wa_e164 IS NOT NULL THEN
    ikey := format('delivery:%s:%s:whatsapp', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'whatsapp', wa_e164, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_delivery_notifications(uuid) TO authenticated, service_role;
