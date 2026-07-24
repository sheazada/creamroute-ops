
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS challan_url text;

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'cash',
  reference text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplier_payments_all ON public.supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase ON public.supplier_payments(purchase_id);

-- Recalc a single purchase's paid amount and status from its supplier_payments
CREATE OR REPLACE FUNCTION public.recalc_purchase(_purchase_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_paid numeric := 0;
  v_total numeric;
  v_status text;
  v_cur text;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.supplier_payments WHERE purchase_id = _purchase_id;
  SELECT total, status INTO v_total, v_cur FROM public.purchases WHERE id = _purchase_id;
  IF v_cur = 'void' THEN
    v_status := 'void';
  ELSIF v_paid <= 0 THEN
    v_status := 'pending';
  ELSIF v_paid < v_total THEN
    v_status := 'partial';
  ELSE
    v_status := 'paid';
  END IF;
  UPDATE public.purchases SET paid = v_paid, status = v_status WHERE id = _purchase_id;
END;
$$;

-- Recalc supplier outstanding = sum of (total - paid) for non-void purchases minus unallocated payments
CREATE OR REPLACE FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE public.suppliers s
     SET outstanding = GREATEST(COALESCE((
       SELECT SUM(total - paid) FROM public.purchases
        WHERE supplier_id = _supplier_id AND status <> 'void'
     ), 0) - COALESCE((
       SELECT SUM(amount) FROM public.supplier_payments
        WHERE supplier_id = _supplier_id AND purchase_id IS NULL
     ), 0), 0)
   WHERE s.id = _supplier_id;
$$;

CREATE OR REPLACE FUNCTION public.tg_supplier_payments_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.purchase_id IS NOT NULL THEN PERFORM public.recalc_purchase(OLD.purchase_id); END IF;
    PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    RETURN OLD;
  ELSE
    IF NEW.purchase_id IS NOT NULL THEN PERFORM public.recalc_purchase(NEW.purchase_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.purchase_id IS DISTINCT FROM NEW.purchase_id AND OLD.purchase_id IS NOT NULL THEN
      PERFORM public.recalc_purchase(OLD.purchase_id);
    END IF;
    PERFORM public.recalc_supplier_outstanding(NEW.supplier_id);
    IF TG_OP = 'UPDATE' AND OLD.supplier_id <> NEW.supplier_id THEN
      PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_payments_recalc ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.supplier_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_payments_recalc();

CREATE OR REPLACE FUNCTION public.tg_purchases_supplier_outstanding()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_supplier_outstanding(NEW.supplier_id);
    IF TG_OP = 'UPDATE' AND OLD.supplier_id <> NEW.supplier_id THEN
      PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_supplier_outstanding ON public.purchases;
CREATE TRIGGER trg_purchases_supplier_outstanding
AFTER INSERT OR UPDATE OF total, paid, status, supplier_id OR DELETE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.tg_purchases_supplier_outstanding();

-- Backfill existing outstanding
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.suppliers LOOP
    PERFORM public.recalc_supplier_outstanding(r.id);
  END LOOP;
END $$;
