
-- Recalc a single invoice's monetary fields from its items and payments
CREATE OR REPLACE FUNCTION public.recalc_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax      numeric := 0;
  v_paid     numeric := 0;
  v_inter    boolean;
  v_total    numeric;
  v_balance  numeric;
  v_status   text;
  v_cur_status text;
BEGIN
  SELECT COALESCE(SUM(taxable),0), COALESCE(SUM(discount),0), COALESCE(SUM(tax_amount),0)
    INTO v_subtotal, v_discount, v_tax
    FROM public.invoice_items WHERE invoice_id = _invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
    FROM public.payments WHERE invoice_id = _invoice_id;

  SELECT (igst > 0), status INTO v_inter, v_cur_status
    FROM public.invoices WHERE id = _invoice_id;

  v_total := v_subtotal + v_tax;
  v_balance := GREATEST(v_total - v_paid, 0);

  IF v_cur_status = 'void' THEN
    v_status := 'void';
  ELSIF v_paid <= 0 THEN
    v_status := 'pending';
  ELSIF v_paid < v_total THEN
    v_status := 'partial';
  ELSE
    v_status := 'paid';
  END IF;

  UPDATE public.invoices
     SET subtotal = v_subtotal,
         discount = v_discount,
         cgst = CASE WHEN COALESCE(v_inter,false) THEN 0 ELSE v_tax/2 END,
         sgst = CASE WHEN COALESCE(v_inter,false) THEN 0 ELSE v_tax/2 END,
         igst = CASE WHEN COALESCE(v_inter,false) THEN v_tax ELSE 0 END,
         total = v_total,
         paid = v_paid,
         balance = CASE WHEN v_cur_status = 'void' THEN 0 ELSE v_balance END,
         status = v_status
   WHERE id = _invoice_id;
END;
$$;

-- Recalc a customer's total outstanding from their non-void invoices
CREATE OR REPLACE FUNCTION public.recalc_customer_outstanding(_customer_id uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.customers c
     SET outstanding = COALESCE((
       SELECT SUM(balance) FROM public.invoices
        WHERE customer_id = _customer_id AND status <> 'void'
     ), 0)
   WHERE c.id = _customer_id;
$$;

-- Trigger: on invoice_items change → recalc parent invoice
CREATE OR REPLACE FUNCTION public.tg_invoice_items_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_invoice(NEW.invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
      PERFORM public.recalc_invoice(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_items_recalc ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_recalc();

-- Trigger: on payments change → recalc parent invoice
CREATE OR REPLACE FUNCTION public.tg_payments_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN PERFORM public.recalc_invoice(OLD.invoice_id); END IF;
    RETURN OLD;
  ELSE
    IF NEW.invoice_id IS NOT NULL THEN PERFORM public.recalc_invoice(NEW.invoice_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
      PERFORM public.recalc_invoice(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_recalc ON public.payments;
CREATE TRIGGER trg_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();

-- Trigger: on invoice change → recalc customer outstanding
CREATE OR REPLACE FUNCTION public.tg_invoices_customer_outstanding()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_outstanding(OLD.customer_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_customer_outstanding(NEW.customer_id);
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.recalc_customer_outstanding(OLD.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_customer_outstanding ON public.invoices;
CREATE TRIGGER trg_invoices_customer_outstanding
AFTER INSERT OR UPDATE OF balance, status, customer_id, total OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_customer_outstanding();

-- Backfill: recompute every existing customer's outstanding once
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.customers LOOP
    PERFORM public.recalc_customer_outstanding(r.id);
  END LOOP;
END $$;
