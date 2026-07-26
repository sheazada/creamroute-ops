-- ============ Part 1: demand consolidation foundation (missing prerequisite) ============
CREATE TABLE IF NOT EXISTS public.delivery_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_code TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_shift TEXT NOT NULL DEFAULT 'morning' CHECK (delivery_shift IN ('morning', 'evening')),
  cutoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'planned', 'dispatched', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_cycles TO authenticated;
GRANT ALL ON public.delivery_cycles TO service_role;
ALTER TABLE public.delivery_cycles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_cycles_delivery_date ON public.delivery_cycles(delivery_date, delivery_shift);

CREATE TABLE IF NOT EXISTS public.demand_consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_no TEXT NOT NULL UNIQUE,
  delivery_cycle_id UUID NOT NULL REFERENCES public.delivery_cycles(id) ON DELETE CASCADE,
  consolidation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'po_generated')),
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_consolidations TO authenticated;
GRANT ALL ON public.demand_consolidations TO service_role;
ALTER TABLE public.demand_consolidations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_demand_consolidations_cycle ON public.demand_consolidations(delivery_cycle_id, status);

CREATE TABLE IF NOT EXISTS public.demand_consolidation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_consolidation_id UUID NOT NULL REFERENCES public.demand_consolidations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  total_ordered_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  buffer_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_procurement_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demand_consolidation_items TO authenticated;
GRANT ALL ON public.demand_consolidation_items TO service_role;
ALTER TABLE public.demand_consolidation_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_demand_consolidation_items_consolidation ON public.demand_consolidation_items(demand_consolidation_id);

CREATE TABLE IF NOT EXISTS public.demand_source_orders (
  demand_consolidation_id UUID NOT NULL REFERENCES public.demand_consolidations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (demand_consolidation_id, order_id)
);
GRANT SELECT, INSERT, DELETE ON public.demand_source_orders TO authenticated;
GRANT ALL ON public.demand_source_orders TO service_role;
ALTER TABLE public.demand_source_orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['delivery_cycles','demand_consolidations','demand_consolidation_items','demand_source_orders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()))', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()))', t||'_delete', t);
    IF t <> 'demand_source_orders' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()))', t||'_update', t);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_delivery_cycles_updated_at ON public.delivery_cycles;
CREATE TRIGGER trg_delivery_cycles_updated_at BEFORE UPDATE ON public.delivery_cycles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_demand_consolidations_updated_at ON public.demand_consolidations;
CREATE TRIGGER trg_demand_consolidations_updated_at BEFORE UPDATE ON public.demand_consolidations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_demand_consolidation_items_updated_at ON public.demand_consolidation_items;
CREATE TRIGGER trg_demand_consolidation_items_updated_at BEFORE UPDATE ON public.demand_consolidation_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_cycle_code(p_order_date DATE, p_shift TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.delivery_cycles WHERE order_date = p_order_date AND delivery_shift = p_shift;
  RETURN 'CYC-' || TO_CHAR(p_order_date, 'YYYYMMDD') || '-' || UPPER(LEFT(p_shift, 1)) || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_consolidation_no(p_date DATE)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.demand_consolidations WHERE consolidation_date = p_date;
  RETURN 'DC-' || TO_CHAR(p_date, 'YYYYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_delivery_cycle(p_delivery_date DATE, p_shift TEXT DEFAULT 'morning')
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cycle_id UUID; v_order_date DATE; v_cutoff TIMESTAMPTZ;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_order_date := p_delivery_date - INTERVAL '1 day';
  v_cutoff := (p_delivery_date::TIMESTAMP - INTERVAL '9 hours')::TIMESTAMPTZ;
  SELECT id INTO v_cycle_id FROM public.delivery_cycles WHERE delivery_date = p_delivery_date AND delivery_shift = p_shift LIMIT 1;
  IF v_cycle_id IS NULL THEN
    INSERT INTO public.delivery_cycles (cycle_code, order_date, delivery_date, delivery_shift, cutoff_at)
    VALUES (public.generate_cycle_code(v_order_date, p_shift), v_order_date, p_delivery_date, p_shift, v_cutoff)
    RETURNING id INTO v_cycle_id;
  END IF;
  RETURN v_cycle_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_demand_consolidation(p_delivery_cycle_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cycle RECORD; v_consolidation_id UUID; v_consolidation_no TEXT; v_user_id UUID;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_cycle FROM public.delivery_cycles WHERE id = p_delivery_cycle_id;
  IF v_cycle IS NULL THEN RAISE EXCEPTION 'Delivery cycle not found'; END IF;
  v_user_id := auth.uid();
  v_consolidation_no := public.generate_consolidation_no(v_cycle.delivery_date);
  INSERT INTO public.demand_consolidations (consolidation_no, delivery_cycle_id, consolidation_date, created_by)
  VALUES (v_consolidation_no, p_delivery_cycle_id, v_cycle.delivery_date, v_user_id)
  RETURNING id INTO v_consolidation_id;

  WITH order_items_agg AS (
    SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS total_qty, AVG(oi.rate) AS avg_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_date = v_cycle.order_date AND o.status NOT IN ('cancelled', 'delivered')
    GROUP BY oi.product_id, oi.product_name
  )
  INSERT INTO public.demand_consolidation_items (
    demand_consolidation_id, product_id, product_name, total_ordered_qty, buffer_qty, final_procurement_qty, unit_price, total_value)
  SELECT v_consolidation_id, product_id, product_name, total_qty, 0, total_qty, avg_price, total_qty * avg_price
  FROM order_items_agg;

  INSERT INTO public.demand_source_orders (demand_consolidation_id, order_id)
  SELECT v_consolidation_id, o.id FROM public.orders o
  WHERE o.order_date = v_cycle.order_date AND o.status NOT IN ('cancelled', 'delivered');

  UPDATE public.delivery_cycles SET status = 'planned' WHERE id = p_delivery_cycle_id;
  RETURN v_consolidation_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.generate_cycle_code(DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_consolidation_no(DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_delivery_cycle(DATE, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_demand_consolidation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_delivery_cycle(DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_demand_consolidation(UUID) TO authenticated;

-- ============ Part 2: purchases enhancement ============
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS delivery_cycle_id UUID REFERENCES public.delivery_cycles(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS ordered_qty NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS variance_type TEXT,
  ADD COLUMN IF NOT EXISTS variance_qty NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS variance_notes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_variance_type_check') THEN
    ALTER TABLE public.purchase_items
      ADD CONSTRAINT purchase_items_variance_type_check
      CHECK (variance_type IS NULL OR variance_type IN ('ok','short','extra','damaged','rejected'));
  END IF;
END $$;

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
  claim_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'credited')),
  submitted_to_sudha_at TIMESTAMPTZ,
  sudha_response TEXT,
  credited_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sudha_claims TO authenticated;
GRANT ALL ON public.sudha_claims TO service_role;
ALTER TABLE public.sudha_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sudha_claims_date ON public.sudha_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_sudha_claims_status ON public.sudha_claims(status);

DROP POLICY IF EXISTS "sudha_claims_select" ON public.sudha_claims;
DROP POLICY IF EXISTS "sudha_claims_insert" ON public.sudha_claims;
DROP POLICY IF EXISTS "sudha_claims_update" ON public.sudha_claims;
DROP POLICY IF EXISTS "sudha_claims_delete" ON public.sudha_claims;
CREATE POLICY "sudha_claims_select" ON public.sudha_claims FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "sudha_claims_insert" ON public.sudha_claims FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY "sudha_claims_update" ON public.sudha_claims FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "sudha_claims_delete" ON public.sudha_claims FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

DROP TRIGGER IF EXISTS trg_sudha_claims_updated_at ON public.sudha_claims;
CREATE TRIGGER trg_sudha_claims_updated_at BEFORE UPDATE ON public.sudha_claims FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.generate_claim_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  RETURN 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;
REVOKE EXECUTE ON FUNCTION public.generate_claim_no() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_claim_no() TO authenticated;

-- Daily reconciliation view (respects RLS of the caller)
DROP VIEW IF EXISTS public.daily_reconciliation;
CREATE VIEW public.daily_reconciliation
WITH (security_invoker = on) AS
SELECT
  p.purchase_date AS date,
  p.bill_no AS challan_no,
  pi.product_name,
  pi.ordered_qty AS ordered_from_sudha,
  pi.quantity AS received_from_sudha,
  COALESCE(d.distributed_qty, 0) AS distributed_to_retailers,
  pi.quantity - COALESCE(d.distributed_qty, 0) AS leftover,
  pi.variance_type,
  pi.variance_qty AS variance_amount
FROM public.purchases p
JOIN public.purchase_items pi ON pi.purchase_id = p.id
LEFT JOIN LATERAL (
  SELECT SUM(ii.quantity) AS distributed_qty
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE i.invoice_date = p.purchase_date
    AND ii.product_name = pi.product_name
    AND i.status <> 'void'
) d ON true
WHERE p.delivery_cycle_id IS NOT NULL;

GRANT SELECT ON public.daily_reconciliation TO authenticated;