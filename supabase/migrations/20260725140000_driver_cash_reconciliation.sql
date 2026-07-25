-- Cash Reconciliation from Driver
-- Tracks cash collected by driver and matched to invoices

CREATE TABLE IF NOT EXISTS public.driver_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_no TEXT NOT NULL UNIQUE,
  driver_name TEXT,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_amount NUMERIC(12,2) NOT NULL DEFAULT 0, -- Total of unpaid invoices for that route/day
  collected_amount NUMERIC(12,2) NOT NULL DEFAULT 0, -- Actual cash brought back
  mismatch_amount NUMERIC(12,2) DEFAULT 0, -- Collected - Expected
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'investigating')),
  notes TEXT,
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_collections_date ON public.driver_collections(delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_collections_status ON public.driver_collections(status);

ALTER TABLE public.driver_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_collections_select" ON public.driver_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "driver_collections_insert" ON public.driver_collections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "driver_collections_update" ON public.driver_collections FOR UPDATE TO authenticated USING (true);

-- Individual payment allocations within a collection
CREATE TABLE IF NOT EXISTS public.collection_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_collection_id UUID NOT NULL REFERENCES public.driver_collections(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'bank', 'mixed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_allocations_collection ON public.collection_allocations(driver_collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_allocations_invoice ON public.collection_allocations(invoice_id);

ALTER TABLE public.collection_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_allocations_select" ON public.collection_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "collection_allocations_insert" ON public.collection_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collection_allocations_update" ON public.collection_allocations FOR UPDATE TO authenticated USING (true);

-- Function to generate collection number
CREATE OR REPLACE FUNCTION public.generate_collection_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.driver_collections WHERE delivery_date = CURRENT_DATE;
  v := 'COL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

-- Function to reconcile: mark invoices as paid based on allocations
CREATE OR REPLACE FUNCTION public.reconcile_collection(_collection_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE alloc RECORD; inv RECORD;
BEGIN
  -- Loop through each allocation
  FOR alloc IN 
    SELECT * FROM public.collection_allocations WHERE driver_collection_id = _collection_id
  LOOP
    -- If invoice_id is set, mark it as paid
    IF alloc.invoice_id IS NOT NULL THEN
      UPDATE public.invoices
      SET 
        status = CASE WHEN paid >= total THEN 'paid' ELSE 'partial' END,
        balance = total - paid
      WHERE id = alloc.invoice_id;
    END IF;

    -- If no invoice_id but customer_id, reduce customer outstanding
    IF alloc.customer_id IS NOT NULL AND alloc.invoice_id IS NULL THEN
      -- This is a general payment to customer, not tied to specific invoice
      -- Just log it in payments table
      INSERT INTO public.payments (
        customer_id, amount, mode, payment_date, notes, invoice_id
      ) VALUES (
        alloc.customer_id, alloc.allocated_amount, alloc.payment_mode, CURRENT_DATE,
        'Driver collection: ' || _collection_id, NULL
      );
    END IF;
  END LOOP;

  -- Mark collection as reconciled
  UPDATE public.driver_collections
  SET status = 'reconciled', reconciled_at = NOW()
  WHERE id = _collection_id;
END;
$$;
