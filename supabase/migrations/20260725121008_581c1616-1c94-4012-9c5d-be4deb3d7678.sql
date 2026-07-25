-- Warehouses / locations
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE TO authenticated USING (true);

-- Enhance product_batches
ALTER TABLE public.product_batches
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'expired', 'consumed'));

UPDATE public.product_batches SET available_qty = quantity WHERE available_qty = 0 AND quantity > 0;

-- Stock adjustments
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no TEXT NOT NULL UNIQUE,
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT CHECK (reason IN ('physical_count', 'damage', 'expiry', 'manual_correction', 'return_from_retailer', 'supplier_return')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'posted')),
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  notes TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustments TO authenticated;
GRANT ALL ON public.stock_adjustments TO service_role;

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON public.stock_adjustments(adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON public.stock_adjustments(status);

CREATE TABLE IF NOT EXISTS public.stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES public.stock_adjustments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
  system_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  physical_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  diff_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  reason_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustment_items TO authenticated;
GRANT ALL ON public.stock_adjustment_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_adjustment_items_adj ON public.stock_adjustment_items(adjustment_id);

CREATE TABLE IF NOT EXISTS public.stock_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recon_no TEXT NOT NULL UNIQUE,
  recon_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  conducted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reconciliations TO authenticated;
GRANT ALL ON public.stock_reconciliations TO service_role;

CREATE TABLE IF NOT EXISTS public.stock_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recon_id UUID NOT NULL REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
  system_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  physical_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  diff_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reconciliation_items TO authenticated;
GRANT ALL ON public.stock_reconciliation_items TO service_role;

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_adjustments_select" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_insert" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_update" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_select" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_adjustments_insert" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stock_adjustments_update" ON public.stock_adjustments FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_adjustment_items_select" ON public.stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_insert" ON public.stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_update" ON public.stock_adjustment_items;
CREATE POLICY "stock_adjustment_items_select" ON public.stock_adjustment_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_adjustment_items_insert" ON public.stock_adjustment_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stock_adjustment_items_update" ON public.stock_adjustment_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_reconciliations_select" ON public.stock_reconciliations;
DROP POLICY IF EXISTS "stock_reconciliations_insert" ON public.stock_reconciliations;
DROP POLICY IF EXISTS "stock_reconciliations_update" ON public.stock_reconciliations;
CREATE POLICY "stock_reconciliations_select" ON public.stock_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_reconciliations_insert" ON public.stock_reconciliations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stock_reconciliations_update" ON public.stock_reconciliations FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "stock_reconciliation_items_select" ON public.stock_reconciliation_items;
DROP POLICY IF EXISTS "stock_reconciliation_items_insert" ON public.stock_reconciliation_items;
DROP POLICY IF EXISTS "stock_reconciliation_items_update" ON public.stock_reconciliation_items;
CREATE POLICY "stock_reconciliation_items_select" ON public.stock_reconciliation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_reconciliation_items_insert" ON public.stock_reconciliation_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stock_reconciliation_items_update" ON public.stock_reconciliation_items FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.generate_adjustment_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_adjustments WHERE adjustment_date = CURRENT_DATE;
  v := 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_recon_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_reconciliations WHERE recon_date = CURRENT_DATE;
  v := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_stock_adjustment(_adjustment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item RECORD;
  batch RECORD;
  signed NUMERIC;
BEGIN
  SELECT * INTO STRICT item FROM public.stock_adjustments WHERE id = _adjustment_id;
  IF item.status != 'pending' THEN
    RAISE EXCEPTION 'Adjustment must be in pending status to post';
  END IF;

  FOR batch IN
    SELECT sai.*, p.name as product_name
    FROM public.stock_adjustment_items sai
    JOIN public.products p ON p.id = sai.product_id
    WHERE sai.adjustment_id = _adjustment_id
  LOOP
    signed := batch.physical_qty - batch.system_qty;

    UPDATE public.products
    SET current_stock = current_stock + signed,
        updated_at = NOW()
    WHERE id = batch.product_id;

    IF batch.batch_id IS NOT NULL THEN
      UPDATE public.product_batches
      SET available_qty = available_qty + signed,
          quantity = quantity + signed,
          damaged_qty = CASE WHEN batch.reason_detail = 'damaged' THEN damaged_qty + ABS(signed) ELSE damaged_qty END,
          updated_at = NOW()
      WHERE id = batch.batch_id;
    END IF;

    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity, note, created_by, ref_id, ref_type
    ) VALUES (
      batch.product_id,
      CASE
        WHEN batch.reason_detail = 'damaged' THEN 'damaged'
        WHEN batch.reason_detail = 'expired' THEN 'expired'
        WHEN signed > 0 THEN 'in'
        ELSE 'out'
      END,
      ABS(signed),
      'Adjustment: ' || item.adjustment_no || ' - ' || COALESCE(batch.reason_detail, item.reason),
      item.approved_by,
      _adjustment_id,
      'stock_adjustment'
    );
  END LOOP;

  UPDATE public.stock_adjustments
  SET status = 'posted', approved_at = NOW(), updated_at = NOW()
  WHERE id = _adjustment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_valuation()
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_qty NUMERIC,
  available_qty NUMERIC,
  damaged_qty NUMERIC,
  avg_cost NUMERIC,
  total_value NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(pb.quantity), 0),
    COALESCE(SUM(pb.available_qty), 0),
    COALESCE(SUM(pb.damaged_qty), 0),
    COALESCE(AVG(NULLIF(pb.cost_price, 0)), p.purchase_price),
    COALESCE(SUM(pb.available_qty * NULLIF(pb.cost_price, 0)), 0)
  FROM public.products p
  LEFT JOIN public.product_batches pb ON pb.product_id = p.id AND pb.status = 'active'
  WHERE p.status = 'active'
  GROUP BY p.id, p.name, p.purchase_price
  HAVING COALESCE(SUM(pb.quantity), 0) > 0
  ORDER BY p.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_near_expiry_stock(_days INT DEFAULT 30)
RETURNS TABLE (
  product_name TEXT,
  batch_no TEXT,
  expiry_date DATE,
  available_qty NUMERIC,
  days_remaining INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name,
    pb.batch_no,
    pb.expiry_date::DATE,
    pb.available_qty,
    (pb.expiry_date::DATE - CURRENT_DATE)::INT
  FROM public.product_batches pb
  JOIN public.products p ON p.id = pb.product_id
  WHERE pb.expiry_date IS NOT NULL
    AND pb.expiry_date > CURRENT_DATE
    AND pb.expiry_date <= CURRENT_DATE + (_days || ' days')::INTERVAL
    AND pb.available_qty > 0
    AND pb.status = 'active'
  ORDER BY pb.expiry_date ASC;
END;
$$;

INSERT INTO public.warehouses (name, location) VALUES ('Main Warehouse', 'Default storage location')
ON CONFLICT (name) DO NOTHING;