CREATE TABLE IF NOT EXISTS public.driver_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_no TEXT NOT NULL UNIQUE,
  driver_name TEXT,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  collected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mismatch_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'investigating')),
  notes TEXT,
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_collections TO authenticated;
GRANT ALL ON public.driver_collections TO service_role;
ALTER TABLE public.driver_collections ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_driver_collections_date ON public.driver_collections(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_collections_status ON public.driver_collections(status);

DROP POLICY IF EXISTS "driver_collections_select" ON public.driver_collections;
DROP POLICY IF EXISTS "driver_collections_insert" ON public.driver_collections;
DROP POLICY IF EXISTS "driver_collections_update" ON public.driver_collections;
DROP POLICY IF EXISTS "driver_collections_delete" ON public.driver_collections;
CREATE POLICY "driver_collections_select" ON public.driver_collections FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "driver_collections_insert" ON public.driver_collections FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "driver_collections_update" ON public.driver_collections FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "driver_collections_delete" ON public.driver_collections FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

DROP TRIGGER IF EXISTS trg_driver_collections_updated_at ON public.driver_collections;
CREATE TRIGGER trg_driver_collections_updated_at BEFORE UPDATE ON public.driver_collections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.collection_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_collection_id UUID NOT NULL REFERENCES public.driver_collections(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'bank', 'mixed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_allocations TO authenticated;
GRANT ALL ON public.collection_allocations TO service_role;
ALTER TABLE public.collection_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_collection_allocations_collection ON public.collection_allocations(driver_collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_allocations_invoice ON public.collection_allocations(invoice_id);

DROP POLICY IF EXISTS "collection_allocations_select" ON public.collection_allocations;
DROP POLICY IF EXISTS "collection_allocations_insert" ON public.collection_allocations;
DROP POLICY IF EXISTS "collection_allocations_update" ON public.collection_allocations;
DROP POLICY IF EXISTS "collection_allocations_delete" ON public.collection_allocations;
CREATE POLICY "collection_allocations_select" ON public.collection_allocations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "collection_allocations_insert" ON public.collection_allocations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "collection_allocations_update" ON public.collection_allocations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "collection_allocations_delete" ON public.collection_allocations FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

CREATE OR REPLACE FUNCTION public.generate_collection_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.driver_collections WHERE delivery_date = CURRENT_DATE;
  RETURN 'COL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;
REVOKE EXECUTE ON FUNCTION public.generate_collection_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_collection_no() TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_collection(_collection_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE alloc RECORD;
BEGIN
  IF NOT public.can_manage_finance(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  FOR alloc IN SELECT * FROM public.collection_allocations WHERE driver_collection_id = _collection_id LOOP
    INSERT INTO public.payments (customer_id, invoice_id, amount, mode, payment_date, notes)
    VALUES (
      alloc.customer_id, alloc.invoice_id, alloc.allocated_amount, alloc.payment_mode, CURRENT_DATE,
      'Driver collection: ' || _collection_id::text
    );
  END LOOP;

  UPDATE public.driver_collections
     SET status = 'reconciled', reconciled_at = NOW(), reconciled_by = auth.uid()
   WHERE id = _collection_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reconcile_collection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_collection(UUID) TO authenticated;