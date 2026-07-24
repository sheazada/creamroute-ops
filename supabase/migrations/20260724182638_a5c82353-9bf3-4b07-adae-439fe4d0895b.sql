
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS ordered_quantity numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivered_quantity numeric(12,2);

UPDATE public.invoice_items SET ordered_quantity = quantity WHERE ordered_quantity IS NULL;
UPDATE public.invoice_items SET delivered_quantity = quantity WHERE delivered_quantity IS NULL;

CREATE OR REPLACE FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_rate numeric;
  v_discount numeric;
  v_gst numeric;
  v_taxable numeric;
  v_tax numeric;
  v_ordered numeric;
  v_all_full boolean := true;
  v_all_zero boolean := true;
  v_row_count int := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_item_id := (rec->>'id')::uuid;
    v_qty := GREATEST(COALESCE((rec->>'delivered')::numeric, 0), 0);
    SELECT rate, discount, gst_rate, COALESCE(ordered_quantity, quantity)
      INTO v_rate, v_discount, v_gst, v_ordered
      FROM public.invoice_items
      WHERE id = v_item_id AND invoice_id = _invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_qty := LEAST(v_qty, v_ordered);
    v_taxable := GREATEST(v_qty * v_rate - COALESCE(v_discount, 0), 0);
    v_tax := v_taxable * COALESCE(v_gst, 0) / 100;
    UPDATE public.invoice_items SET
      ordered_quantity = v_ordered,
      delivered_quantity = v_qty,
      quantity = v_qty,
      taxable = v_taxable,
      tax_amount = v_tax,
      amount = v_taxable + v_tax
    WHERE id = v_item_id;
    v_row_count := v_row_count + 1;
    IF v_qty < v_ordered THEN v_all_full := false; END IF;
    IF v_qty > 0 THEN v_all_zero := false; END IF;
  END LOOP;

  IF v_row_count = 0 THEN RETURN 'delivered'; END IF;
  IF v_all_zero THEN RETURN 'failed'; END IF;
  IF v_all_full THEN RETURN 'delivered'; END IF;
  RETURN 'partially_delivered';
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_delivery_quantities(uuid, jsonb) TO authenticated;
