-- Delivery Cycles: represents a delivery batch controlled by cut-off rules
CREATE TABLE IF NOT EXISTS public.delivery_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_code TEXT NOT NULL UNIQUE,
  order_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_shift TEXT NOT NULL DEFAULT 'morning' CHECK (delivery_shift IN ('morning', 'evening')),
  cutoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'planned', 'dispatched', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_cycles_delivery_date 
  ON public.delivery_cycles(delivery_date, delivery_shift);

-- Demand Consolidations: the aggregation run
CREATE TABLE IF NOT EXISTS public.demand_consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidation_no TEXT NOT NULL UNIQUE,
  delivery_cycle_id UUID NOT NULL REFERENCES public.delivery_cycles(id) ON DELETE CASCADE,
  consolidation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'po_generated')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_consolidations_cycle 
  ON public.demand_consolidations(delivery_cycle_id, status);

-- Demand Consolidation Items: product-wise totals
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demand_consolidation_items_consolidation 
  ON public.demand_consolidation_items(demand_consolidation_id);

-- Demand Source Orders: which orders were included in the consolidation
CREATE TABLE IF NOT EXISTS public.demand_source_orders (
  demand_consolidation_id UUID NOT NULL REFERENCES public.demand_consolidations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (demand_consolidation_id, order_id)
);

-- Enable RLS
ALTER TABLE public.delivery_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_consolidation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_source_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_cycles
DROP POLICY IF EXISTS "delivery_cycles_select" ON public.delivery_cycles;
DROP POLICY IF EXISTS "delivery_cycles_insert" ON public.delivery_cycles;
DROP POLICY IF EXISTS "delivery_cycles_update" ON public.delivery_cycles;
DROP POLICY IF EXISTS "delivery_cycles_delete" ON public.delivery_cycles;

CREATE POLICY "delivery_cycles_select" ON public.delivery_cycles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "delivery_cycles_insert" ON public.delivery_cycles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "delivery_cycles_update" ON public.delivery_cycles
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "delivery_cycles_delete" ON public.delivery_cycles
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for demand_consolidations
DROP POLICY IF EXISTS "demand_consolidations_select" ON public.demand_consolidations;
DROP POLICY IF EXISTS "demand_consolidations_insert" ON public.demand_consolidations;
DROP POLICY IF EXISTS "demand_consolidations_update" ON public.demand_consolidations;
DROP POLICY IF EXISTS "demand_consolidations_delete" ON public.demand_consolidations;

CREATE POLICY "demand_consolidations_select" ON public.demand_consolidations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "demand_consolidations_insert" ON public.demand_consolidations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "demand_consolidations_update" ON public.demand_consolidations
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "demand_consolidations_delete" ON public.demand_consolidations
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for demand_consolidation_items
DROP POLICY IF EXISTS "demand_consolidation_items_select" ON public.demand_consolidation_items;
DROP POLICY IF EXISTS "demand_consolidation_items_insert" ON public.demand_consolidation_items;
DROP POLICY IF EXISTS "demand_consolidation_items_update" ON public.demand_consolidation_items;
DROP POLICY IF EXISTS "demand_consolidation_items_delete" ON public.demand_consolidation_items;

CREATE POLICY "demand_consolidation_items_select" ON public.demand_consolidation_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "demand_consolidation_items_insert" ON public.demand_consolidation_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "demand_consolidation_items_update" ON public.demand_consolidation_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "demand_consolidation_items_delete" ON public.demand_consolidation_items
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for demand_source_orders
DROP POLICY IF EXISTS "demand_source_orders_select" ON public.demand_source_orders;
DROP POLICY IF EXISTS "demand_source_orders_insert" ON public.demand_source_orders;
DROP POLICY IF EXISTS "demand_source_orders_delete" ON public.demand_source_orders;

CREATE POLICY "demand_source_orders_select" ON public.demand_source_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "demand_source_orders_insert" ON public.demand_source_orders
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "demand_source_orders_delete" ON public.demand_source_orders
  FOR DELETE TO authenticated USING (true);

-- Function to generate cycle code
CREATE OR REPLACE FUNCTION public.generate_cycle_code(p_order_date DATE, p_shift TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.delivery_cycles
  WHERE order_date = p_order_date AND delivery_shift = p_shift;
  
  v_code := 'CYC-' || TO_CHAR(p_order_date, 'YYYYMMDD') || '-' || UPPER(LEFT(p_shift, 1)) || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  
  RETURN v_code;
END;
$$;

-- Function to generate consolidation number
CREATE OR REPLACE FUNCTION public.generate_consolidation_no(p_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_no TEXT;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.demand_consolidations
  WHERE consolidation_date = p_date;
  
  v_no := 'DC-' || TO_CHAR(p_date, 'YYYYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  
  RETURN v_no;
END;
$$;

-- Function to auto-generate delivery cycle for a date
CREATE OR REPLACE FUNCTION public.ensure_delivery_cycle(p_delivery_date DATE, p_shift TEXT DEFAULT 'morning')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_id UUID;
  v_order_date DATE;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_order_date := p_delivery_date - INTERVAL '1 day';
  v_cutoff := (p_delivery_date::TIMESTAMP - INTERVAL '9 hours')::TIMESTAMPTZ;
  
  SELECT id INTO v_cycle_id
  FROM public.delivery_cycles
  WHERE delivery_date = p_delivery_date AND delivery_shift = p_shift
  LIMIT 1;
  
  IF v_cycle_id IS NULL THEN
    INSERT INTO public.delivery_cycles (cycle_code, order_date, delivery_date, delivery_shift, cutoff_at)
    VALUES (
      public.generate_cycle_code(v_order_date, p_shift),
      v_order_date,
      p_delivery_date,
      p_shift,
      v_cutoff
    )
    RETURNING id INTO v_cycle_id;
  END IF;
  
  RETURN v_cycle_id;
END;
$$;

-- Function to create demand consolidation from orders
CREATE OR REPLACE FUNCTION public.create_demand_consolidation(
  p_delivery_cycle_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle RECORD;
  v_consolidation_id UUID;
  v_consolidation_no TEXT;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_cycle FROM public.delivery_cycles WHERE id = p_delivery_cycle_id;
  IF v_cycle IS NULL THEN
    RAISE EXCEPTION 'Delivery cycle not found';
  END IF;
  
  SELECT current_setting('request.jwt.claim.sub', true)::UUID INTO v_user_id;
  
  v_consolidation_no := public.generate_consolidation_no(v_cycle.delivery_date);
  
  INSERT INTO public.demand_consolidations (
    consolidation_no, delivery_cycle_id, consolidation_date, created_by
  ) VALUES (
    v_consolidation_no, p_delivery_cycle_id, v_cycle.delivery_date, v_user_id
  )
  RETURNING id INTO v_consolidation_id;
  
  -- Aggregate orders into product-wise demand
  WITH order_items_agg AS (
    SELECT 
      oi.product_id,
      oi.product_name,
      SUM(oi.quantity) as total_qty,
      AVG(oi.rate) as avg_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_date = v_cycle.order_date
      AND o.status NOT IN ('cancelled', 'delivered')
    GROUP BY oi.product_id, oi.product_name
  )
  INSERT INTO public.demand_consolidation_items (
    demand_consolidation_id, product_id, product_name, 
    total_ordered_qty, buffer_qty, final_procurement_qty, unit_price, total_value
  )
  SELECT 
    v_consolidation_id,
    product_id,
    product_name,
    total_qty,
    0,
    total_qty,
    avg_price,
    total_qty * avg_price
  FROM order_items_agg;
  
  -- Link source orders
  INSERT INTO public.demand_source_orders (demand_consolidation_id, order_id)
  SELECT v_consolidation_id, o.id
  FROM public.orders o
  WHERE o.order_date = v_cycle.order_date
    AND o.status NOT IN ('cancelled', 'delivered');
  
  -- Update cycle status
  UPDATE public.delivery_cycles
  SET status = 'planned'
  WHERE id = p_delivery_cycle_id;
  
  RETURN v_consolidation_id;
END;
$$;
