-- Enhance purchases to link with demand consolidation
ALTER TABLE public.purchases 
  ADD COLUMN IF NOT EXISTS delivery_cycle_id UUID REFERENCES public.delivery_cycles(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS ordered_qty NUMERIC(12,2), -- From demand consolidation
  ADD COLUMN IF NOT EXISTS variance_type TEXT CHECK (variance_type IN ('ok', 'short', 'extra', 'damaged', 'rejected')),
  ADD COLUMN IF NOT EXISTS variance_qty NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS variance_notes TEXT;

-- Keep sudha_claims table for claims tracking
CREATE TABLE IF NOT EXISTS public.sudha_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no TEXT NOT NULL UNIQUE,
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('short_supply', 'damaged', 'quality', 'packaging', 'expired_early')),
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  claim_amount NUMERIC(12,2) DEFAULT 0,
  reason TEXT NOT NULL,
  evidence_url TEXT,
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

ALTER TABLE public.sudha_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sudha_claims_select" ON public.sudha_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "sudha_claims_insert" ON public.sudha_claims FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sudha_claims_update" ON public.sudha_claims FOR UPDATE TO authenticated USING (true);

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

-- Daily reconciliation view: ordered vs received vs distributed
CREATE OR REPLACE VIEW public.daily_reconciliation AS
SELECT 
  p.purchase_date as date,
  p.bill_no as challan_no,
  pi.product_name,
  pi.ordered_qty as ordered_from_sudha,
  pi.quantity as received_from_sudha,
  COALESCE(d.distributed_qty, 0) as distributed_to_retailers,
  pi.quantity - COALESCE(d.distributed_qty, 0) as leftover,
  pi.variance_type,
  pi.variance_qty as variance_amount
FROM public.purchases p
JOIN public.purchase_items pi ON pi.purchase_id = p.id
LEFT JOIN LATERAL (
  SELECT SUM(ii.quantity) as distributed_qty
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE i.invoice_date = p.purchase_date
    AND ii.product_name = pi.product_name
    AND i.status != 'void'
) d ON true
WHERE p.delivery_cycle_id IS NOT NULL
ORDER BY p.purchase_date DESC, pi.product_name;
