-- ===== Reminder templates & logs =====
CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  days_overdue INT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  subject TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_templates TO authenticated;
GRANT ALL ON public.reminder_templates TO service_role;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_templates_select" ON public.reminder_templates;
DROP POLICY IF EXISTS "reminder_templates_insert" ON public.reminder_templates;
DROP POLICY IF EXISTS "reminder_templates_update" ON public.reminder_templates;
DROP POLICY IF EXISTS "reminder_templates_delete" ON public.reminder_templates;
CREATE POLICY "reminder_templates_select" ON public.reminder_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "reminder_templates_insert" ON public.reminder_templates FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "reminder_templates_update" ON public.reminder_templates FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "reminder_templates_delete" ON public.reminder_templates FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

DROP TRIGGER IF EXISTS trg_reminder_templates_updated_at ON public.reminder_templates;
CREATE TRIGGER trg_reminder_templates_updated_at BEFORE UPDATE ON public.reminder_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.reminder_templates(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT ON public.reminder_logs TO authenticated;
GRANT ALL ON public.reminder_logs TO service_role;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reminder_logs_invoice_template ON public.reminder_logs(invoice_id, template_id);

DROP POLICY IF EXISTS "reminder_logs_select" ON public.reminder_logs;
DROP POLICY IF EXISTS "reminder_logs_insert" ON public.reminder_logs;
CREATE POLICY "reminder_logs_select" ON public.reminder_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "reminder_logs_insert" ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));

INSERT INTO public.reminder_templates (name, days_overdue, channel, subject, body) VALUES
  ('Gentle Reminder (3 Days)', 3, 'whatsapp', NULL,
   'Namaste {customer_name}, this is a gentle reminder from DairyFlow. Your invoice {invoice_no} for ₹{outstanding} was due on {due_date}. Please arrange payment at your earliest convenience. Thank you!'),
  ('Firm Reminder (7 Days)', 7, 'whatsapp', NULL,
   'Dear {customer_name}, our records show that invoice {invoice_no} for ₹{outstanding} is now 7 days overdue (due on {due_date}). Please clear the outstanding amount immediately to avoid service interruption. Regards, DairyFlow.'),
  ('Final Notice (15 Days)', 15, 'whatsapp', NULL,
   'URGENT: {customer_name}, your payment of ₹{outstanding} for invoice {invoice_no} is 15 days overdue. Please pay immediately to avoid credit hold. If already paid, please ignore this message. DairyFlow Accounts.')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_reminder_been_sent(_invoice_id UUID, _template_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.reminder_logs WHERE invoice_id = _invoice_id AND template_id = _template_id AND status = 'sent');
$$;
REVOKE EXECUTE ON FUNCTION public.has_reminder_been_sent(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_reminder_been_sent(UUID, UUID) TO authenticated;

-- ===== Invoice revisions =====
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revision_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_revised BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.invoice_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  revision_number INT NOT NULL DEFAULT 1,
  original_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  revised_by UUID,
  revision_reason TEXT NOT NULL,
  changes_json JSONB NOT NULL,
  original_total NUMERIC(12,2) NOT NULL,
  revised_total NUMERIC(12,2) NOT NULL,
  revised_invoice_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT ON public.invoice_revisions TO authenticated;
GRANT ALL ON public.invoice_revisions TO service_role;
ALTER TABLE public.invoice_revisions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice ON public.invoice_revisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_revisions_original ON public.invoice_revisions(original_invoice_id);

DROP POLICY IF EXISTS "invoice_revisions_select" ON public.invoice_revisions;
DROP POLICY IF EXISTS "invoice_revisions_insert" ON public.invoice_revisions;
CREATE POLICY "invoice_revisions_select" ON public.invoice_revisions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "invoice_revisions_insert" ON public.invoice_revisions FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_next_revision_no(_invoice_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(revision_number), 0) + 1 FROM public.invoice_revisions WHERE invoice_id = _invoice_id;
$$;
REVOKE EXECUTE ON FUNCTION public.get_next_revision_no(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_revision_no(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revise_invoice(
  _invoice_id UUID,
  _revision_reason TEXT,
  _revised_items JSONB,
  _revised_by UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig RECORD;
  v_new_id UUID;
  v_rev_no INT;
  v_revised_total NUMERIC(12,2) := 0;
  v_changes JSONB := '[]'::JSONB;
  v_new_no TEXT;
  v_item JSONB;
  v_oi RECORD;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_orig FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  v_rev_no := public.get_next_revision_no(_invoice_id);
  v_new_no := v_orig.invoice_no || '-R' || v_rev_no;

  INSERT INTO public.invoices (
    invoice_no, customer_id, invoice_date, due_date, notes,
    revision_count, superseded_by, is_revised, status
  ) VALUES (
    v_new_no, v_orig.customer_id, v_orig.invoice_date, v_orig.due_date,
    COALESCE(v_orig.notes, '') || ' (Revised)', v_rev_no, _invoice_id, TRUE, 'pending'
  ) RETURNING id INTO v_new_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_revised_items) LOOP
    SELECT * INTO v_oi FROM public.invoice_items
     WHERE invoice_id = _invoice_id AND product_id = (v_item->>'product_id')::UUID
     LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_changes := v_changes || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'product_name', v_oi.product_name,
      'original_qty', v_oi.quantity,
      'revised_qty', (v_item->>'qty')::NUMERIC,
      'original_amount', v_oi.amount,
      'revised_amount', (v_item->>'amount')::NUMERIC
    );
    v_revised_total := v_revised_total + (v_item->>'amount')::NUMERIC;

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, hsn_code, unit,
      quantity, rate, discount, gst_rate, taxable, tax_amount, amount
    ) VALUES (
      v_new_id, v_oi.product_id, v_oi.product_name, v_oi.hsn_code, v_oi.unit,
      (v_item->>'qty')::NUMERIC,
      COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate),
      0, v_oi.gst_rate,
      GREATEST((v_item->>'qty')::NUMERIC * COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate), 0),
      GREATEST((v_item->>'qty')::NUMERIC * COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate), 0) * COALESCE(v_oi.gst_rate,0) / 100,
      (v_item->>'amount')::NUMERIC
    );
  END LOOP;

  UPDATE public.invoices
     SET superseded_by = v_new_id, is_revised = TRUE, revision_count = v_rev_no
   WHERE id = _invoice_id;

  INSERT INTO public.invoice_revisions (
    invoice_id, revision_number, original_invoice_id, revised_by,
    revision_reason, changes_json, original_total, revised_total, revised_invoice_no
  ) VALUES (
    _invoice_id, v_rev_no, _invoice_id, COALESCE(_revised_by, auth.uid()),
    _revision_reason, v_changes, v_orig.total, v_revised_total, v_new_no
  );

  RETURN jsonb_build_object(
    'revised_invoice_id', v_new_id,
    'revised_invoice_no', v_new_no,
    'revision_number', v_rev_no
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.revise_invoice(UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revise_invoice(UUID, TEXT, JSONB, UUID) TO authenticated;