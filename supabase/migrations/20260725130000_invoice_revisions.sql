-- Invoice Revision History
-- Tracks all revisions to invoices with reason and user

CREATE TABLE IF NOT EXISTS public.invoice_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  revision_number INT NOT NULL DEFAULT 1,
  original_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  revised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revision_reason TEXT NOT NULL,
  changes_json JSONB NOT NULL, -- Array of {product_id, product_name, original_qty, revised_qty, original_amount, revised_amount}
  original_total NUMERIC(12,2) NOT NULL,
  revised_total NUMERIC(12,2) NOT NULL,
  revised_invoice_no TEXT, -- The new invoice number after revision
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice ON public.invoice_revisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_revisions_original ON public.invoice_revisions(original_invoice_id);

ALTER TABLE public.invoice_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_revisions_select" ON public.invoice_revisions;
DROP POLICY IF EXISTS "invoice_revisions_insert" ON public.invoice_revisions;

CREATE POLICY "invoice_revisions_select" ON public.invoice_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_revisions_insert" ON public.invoice_revisions FOR INSERT TO authenticated WITH CHECK (true);

-- Add revision tracking to invoices table
DO $$ BEGIN
  ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_revised BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Function to get next revision number for an invoice
CREATE OR REPLACE FUNCTION public.get_next_revision_no(_invoice_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_count
  FROM public.invoice_revisions
  WHERE invoice_id = _invoice_id;
  RETURN v_count;
END;
$$;

-- Function to revise an invoice
CREATE OR REPLACE FUNCTION public.revise_invoice(
  _invoice_id UUID,
  _revision_reason TEXT,
  _revised_items JSONB, -- Array of {product_id, qty, amount}
  _revised_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_original_invoice RECORD;
  v_revised_invoice_id UUID;
  v_revision_no INT;
  v_revised_total NUMERIC(12,2) := 0;
  v_changes JSONB;
  v_new_invoice_no TEXT;
  v_item JSONB;
  v_original_item RECORD;
BEGIN
  -- Get original invoice
  SELECT * INTO v_original_invoice FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Get next revision number
  SELECT public.get_next_revision_no(_invoice_id) INTO v_revision_no;

  -- Generate new invoice number
  v_new_invoice_no := v_original_invoice.invoice_no || '-R' || v_revision_no;

  -- Build changes array by comparing original vs revised
  v_changes := '[]'::JSONB;
  
  -- For each revised item, compare with original
  FOR v_item IN SELECT * FROM jsonb_array_elements(_revised_items)
  LOOP
    SELECT * INTO v_original_item 
    FROM public.invoice_items 
    WHERE invoice_id = _invoice_id 
      AND product_id = (v_item->>'product_id')::UUID;
    
    IF FOUND THEN
      v_changes := v_changes || jsonb_build_object(
        'product_id', v_item->>'product_id',
        'product_name', v_original_item.product_name,
        'original_qty', v_original_item.quantity,
        'revised_qty', (v_item->>'qty')::NUMERIC,
        'original_amount', v_original_item.amount,
        'revised_amount', (v_item->>'amount')::NUMERIC
      );
      v_revised_total := v_revised_total + (v_item->>'amount')::NUMERIC;
    END IF;
  END LOOP;

  -- Create revised invoice
  INSERT INTO public.invoices (
    invoice_no, customer_id, invoice_date, due_date,
    subtotal, tax_total, discount, total,
    outstanding, status, notes,
    revision_count, superseded_by, is_revised
  ) VALUES (
    v_new_invoice_no, v_original_invoice.customer_id, v_original_invoice.invoice_date, v_original_invoice.due_date,
    v_revised_total, v_original_invoice.tax_total, v_original_invoice.discount, v_revised_total,
    v_revised_total - v_original_invoice.paid, 'unpaid', v_original_invoice.notes || ' (Revised)',
    v_revision_no, _invoice_id, TRUE
  )
  RETURNING id INTO v_revised_invoice_id;

  -- Insert revised items
  FOR v_item IN SELECT * FROM jsonb_array_elements(_revised_items)
  LOOP
    SELECT product_name INTO v_original_item FROM public.invoice_items 
    WHERE invoice_id = _invoice_id AND product_id = (v_item->>'product_id')::UUID;
    
    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, quantity, rate, amount, gst_rate
    ) VALUES (
      v_revised_invoice_id, 
      (v_item->>'product_id')::UUID, 
      v_original_item.product_name,
      (v_item->>'qty')::NUMERIC,
      (v_item->>'rate')::NUMERIC,
      (v_item->>'amount')::NUMERIC,
      v_original_item.gst_rate
    );
  END LOOP;

  -- Mark original as superseded
  UPDATE public.invoices 
  SET superseded_by = v_revised_invoice_id, status = 'revised'
  WHERE id = _invoice_id;

  -- Log the revision
  INSERT INTO public.invoice_revisions (
    invoice_id, revision_number, original_invoice_id, revised_by,
    revision_reason, changes_json, original_total, revised_total, revised_invoice_no
  ) VALUES (
    _invoice_id, v_revision_no, _invoice_id, _revised_by,
    _revision_reason, v_changes, v_original_invoice.total, v_revised_total, v_new_invoice_no
  );

  -- Return the revised invoice ID and number
  RETURN jsonb_build_object(
    'revised_invoice_id', v_revised_invoice_id,
    'revised_invoice_no', v_new_invoice_no,
    'revision_number', v_revision_no
  );
END;
$$;
