-- Sudha Challan Entry
-- Records what Sudha delivered against your demand consolidation

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gstin TEXT,
  mobile TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only create if not exists to avoid conflicts
DO $$ BEGIN
  INSERT INTO public.suppliers (name) 
  SELECT 'Sudha Dairy' WHERE NOT EXISTS (SELECT 1 FROM public.suppliers WHERE name = 'Sudha Dairy');
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated USING (true);

-- Main challan table
CREATE TABLE IF NOT EXISTS public.sudha_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_no TEXT NOT NULL UNIQUE, -- Sudha's challan number
  challan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  delivery_cycle_id UUID, -- Link to the demand consolidation
  delivery_date DATE, -- Date stock was received (may differ from challan date)
  vehicle_no TEXT,
  driver_name TEXT,
  
  -- Financial totals from Sudha's challan
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Reconciliation
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verified', 'disputed')),
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sudha_challans_date ON public.sudha_challans(challan_date DESC);
CREATE INDEX IF NOT EXISTS idx_sudha_challans_cycle ON public.sudha_challans(delivery_cycle_id);

ALTER TABLE public.sudha_challans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sudha_challans_select" ON public.sudha_challans FOR SELECT TO authenticated USING (true);
CREATE POLICY "sudha_challans_insert" ON public.sudha_challans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sudha_challans_update" ON public.sudha_challans FOR UPDATE TO authenticated USING (true);

-- Challan items (what Sudha actually delivered)
CREATE TABLE IF NOT EXISTS public.sudha_challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.sudha_challans(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL, -- Keep name even if product deleted
  ordered_qty NUMERIC(12,2) DEFAULT 0, -- From demand consolidation
  received_qty NUMERIC(12,2) NOT NULL DEFAULT 0, -- What Sudha actually gave
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance_type TEXT DEFAULT 'ok' CHECK (variance_type IN ('ok', 'short', 'extra', 'rejected')),
  variance_qty NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sudha_challan_items_challan ON public.sudha_challan_items(challan_id);
CREATE INDEX IF NOT EXISTS idx_sudha_challan_items_product ON public.sudha_challan_items(product_id);

ALTER TABLE public.sudha_challan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sudha_challan_items_select" ON public.sudha_challan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sudha_challan_items_insert" ON public.sudha_challan_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sudha_challan_items_update" ON public.sudha_challan_items FOR UPDATE TO authenticated USING (true);

-- Claims to Sudha (damaged, short supply, quality issues)
CREATE TABLE IF NOT EXISTS public.sudha_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no TEXT NOT NULL UNIQUE,
  challan_id UUID REFERENCES public.sudha_challans(id) ON DELETE SET NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('short_supply', 'damaged', 'quality', 'packaging', 'expired_early')),
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  claim_amount NUMERIC(12,2) DEFAULT 0,
  reason TEXT NOT NULL,
  evidence_url TEXT, -- Photo URL if any
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'credited')),
  submitted_to_sudha_at TIMESTAMPTZ,
  sudha_response TEXT,
  credited_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sudha_claims_date ON public.sudha_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_sudha_claims_status ON public.sudha_claims(status);
CREATE INDEX IF NOT EXISTS idx_sudha_claims_challan ON public.sudha_claims(challan_id);

ALTER TABLE public.sudha_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sudha_claims_select" ON public.sudha_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "sudha_claims_insert" ON public.sudha_claims FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sudha_claims_update" ON public.sudha_claims FOR UPDATE TO authenticated USING (true);

-- Function to generate challan number
CREATE OR REPLACE FUNCTION public.generate_sudha_challan_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_challans WHERE challan_date = CURRENT_DATE;
  v := 'SUDHA-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

-- Function to generate claim number
CREATE OR REPLACE FUNCTION public.generate_claim_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  v := 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

-- Daily reconciliation view (Received vs Distributed vs Leftover)
CREATE OR REPLACE VIEW public.daily_reconciliation AS
SELECT 
  c.challan_date as date,
  c.challan_no,
  ci.product_name,
  SUM(ci.received_qty) as received_qty,
  COALESCE(d.distributed_qty, 0) as distributed_qty,
  SUM(ci.received_qty) - COALESCE(d.distributed_qty, 0) as leftover_qty,
  SUM(CASE WHEN ci.variance_type = 'short' THEN ABS(ci.variance_qty) ELSE 0 END) as short_qty,
  SUM(CASE WHEN ci.variance_type = 'damaged' OR ci.variance_type = 'rejected' THEN ci.variance_qty ELSE 0 END) as damaged_qty
FROM public.sudha_challans c
JOIN public.sudha_challan_items ci ON ci.challan_id = c.id
LEFT JOIN LATERAL (
  SELECT SUM(ii.quantity) as distributed_qty
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE i.invoice_date = c.challan_date
    AND ii.product_name = ci.product_name
    AND i.status != 'void'
) d ON true
GROUP BY c.challan_date, c.challan_no, ci.product_name, d.distributed_qty
ORDER BY c.challan_date DESC, ci.product_name;
