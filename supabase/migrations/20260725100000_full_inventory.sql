-- Warehouses / locations
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE TO authenticated USING (true);

-- Enhance product_batches with warehouse, cost, quantity breakdown
ALTER TABLE public.product_batches
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_qty NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'expired', 'consumed'));

-- Auto-populate available_qty from quantity for existing rows
UPDATE public.product_batches SET available_qty = quantity WHERE available_qty = 0 AND quantity > 0;

-- Stock adjustments (requests with approval)
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

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON public.stock_adjustments(adjustment_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON public.stock_adjustments(status);

-- Adjustment items
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

CREATE INDEX IF NOT EXISTS idx_adjustment_items_adj ON public.stock_adjustment_items(adjustment_id);

-- Physical stock reconciliations
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

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  -- adjustments
  CREATE POLICY "stock_adjustments_select" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
  CREATE POLICY "stock_adjustments_insert" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "stock_adjustments_update" ON public.stock_adjustments FOR UPDATE TO authenticated USING (true);
  -- adjustment items
  CREATE POLICY "stock_adjustment_items_select" ON public.stock_adjustment_items FOR SELECT TO authenticated USING (true);
  CREATE POLICY "stock_adjustment_items_insert" ON public.stock_adjustment_items FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "stock_adjustment_items_update" ON public.stock_adjustment_items FOR UPDATE TO authenticated USING (true);
  -- reconciliations
  CREATE POLICY "stock_reconciliations_select" ON public.stock_reconciliations FOR SELECT TO authenticated USING (true);
  CREATE POLICY "stock_reconciliations_insert" ON public.stock_reconciliations FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "stock_reconciliations_update" ON public.stock_reconciliations FOR UPDATE TO authenticated USING (true);
  -- reconciliation items
  CREATE POLICY "stock_reconciliation_items_select" ON public.stock_reconciliation_items FOR SELECT TO authenticated USING (true);
  CREATE POLICY "stock_reconciliation_items_insert" ON public.stock_reconciliation_items FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "stock_reconciliation_items_update" ON public.stock_reconciliation_items FOR UPDATE TO authenticated USING (true);
END $$;

-- Generate adjustment number
CREATE OR REPLACE FUNCTION public.generate_adjustment_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_adjustments WHERE adjustment_date = CURRENT_DATE;
  v := 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

-- Generate reconciliation number
CREATE OR REPLACE FUNCTION public.generate_recon_no()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_reconciliations WHERE recon_date = CURRENT_DATE;
  v := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;

-- Approve & post stock adjustment
CREATE OR REPLACE FUNCTION public.post_stock_adjustment(_adjustment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item RECORD;
  prod RECORD;
  batch RECORD;
  signed NUMERIC;
BEGIN
  -- Verify status
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

    -- Update product current_stock
    UPDATE public.products
    SET current_stock = current_stock + signed,
        updated_at = NOW()
    WHERE id = batch.product_id;

    -- Update batch available_qty if batch specified
    IF batch.batch_id IS NOT NULL THEN
      UPDATE public.product_batches
      SET available_qty = available_qty + signed,
          quantity = quantity + signed,
          damaged_qty = CASE WHEN batch.reason_detail = 'damaged' THEN damaged_qty + ABS(signed) ELSE damaged_qty END,
          updated_at = NOW()
      WHERE id = batch.batch_id;
    END IF;

    -- Log movement
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

  -- Mark as posted
  UPDATE public.stock_adjustments
  SET status = 'posted', approved_at = NOW(), updated_at = NOW()
  WHERE id = _adjustment_id;
END;
$$;

-- Get stock valuation summary
CREATE OR REPLACE FUNCTION public.get_stock_valuation()
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_qty NUMERIC,
  available_qty NUMERIC,
  damaged_qty NUMERIC,
  avg_cost NUMERIC,
  total_value NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Get near-expiry stock (customizable days)
CREATE OR REPLACE FUNCTION public.get_near_expiry_stock(_days INT DEFAULT 30)
RETURNS TABLE (
  product_name TEXT,
  batch_no TEXT,
  expiry_date DATE,
  available_qty NUMERIC,
  days_remaining INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Seed default warehouse
INSERT INTO public.warehouses (name, location) VALUES ('Main Warehouse', 'Default storage location')
ON CONFLICT (name) DO NOTHING;
