-- Crate Types (e.g., Milk Crate 20L, Curd Crate, etc.)
CREATE TABLE IF NOT EXISTS public.crate_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crate Transactions (issue/return/damaged/lost)
CREATE TABLE IF NOT EXISTS public.crate_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crate_type_id UUID NOT NULL REFERENCES public.crate_types(id) ON DELETE CASCADE,
  retailer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('issue', 'return', 'damaged', 'lost')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crate_transactions_retailer_date 
  ON public.crate_transactions(retailer_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_crate_transactions_delivery 
  ON public.crate_transactions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_crate_transactions_date 
  ON public.crate_transactions(transaction_date DESC);

-- Enable RLS
ALTER TABLE public.crate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crate_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crate_types
DROP POLICY IF EXISTS "crate_types_select" ON public.crate_types;
DROP POLICY IF EXISTS "crate_types_insert" ON public.crate_types;
DROP POLICY IF EXISTS "crate_types_update" ON public.crate_types;
DROP POLICY IF EXISTS "crate_types_delete" ON public.crate_types;

CREATE POLICY "crate_types_select" ON public.crate_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crate_types_insert" ON public.crate_types
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crate_types_update" ON public.crate_types
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crate_types_delete" ON public.crate_types
  FOR DELETE TO authenticated USING (true);

-- RLS Policies for crate_transactions
DROP POLICY IF EXISTS "crate_transactions_select" ON public.crate_transactions;
DROP POLICY IF EXISTS "crate_transactions_insert" ON public.crate_transactions;
DROP POLICY IF EXISTS "crate_transactions_update" ON public.crate_transactions;
DROP POLICY IF EXISTS "crate_transactions_delete" ON public.crate_transactions;

CREATE POLICY "crate_transactions_select" ON public.crate_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "crate_transactions_insert" ON public.crate_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "crate_transactions_update" ON public.crate_transactions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crate_transactions_delete" ON public.crate_transactions
  FOR DELETE TO authenticated USING (true);

-- Seed default crate types
INSERT INTO public.crate_types (name, description) VALUES
  ('Milk Crate 20L', 'Standard 20-liter milk crate'),
  ('Milk Crate 40L', 'Large 40-liter milk crate'),
  ('Curd Crate', 'Curd container crate'),
  ('Ghee Container', 'Ghee packaging crate')
ON CONFLICT (name) DO NOTHING;

-- Function to calculate current crate balance for a retailer
CREATE OR REPLACE FUNCTION public.calculate_crate_balance(
  p_retailer_id UUID,
  p_crate_type_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type = 'issue' THEN quantity
      WHEN transaction_type = 'return' THEN -quantity
      WHEN transaction_type = 'damaged' THEN -quantity
      WHEN transaction_type = 'lost' THEN -quantity
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.crate_transactions
  WHERE retailer_id = p_retailer_id
    AND (p_crate_type_id IS NULL OR crate_type_id = p_crate_type_id);
  
  RETURN v_balance;
END;
$$;

-- Function to get crate balance for all retailers on a specific date
CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_crate_type_id UUID DEFAULT NULL
)
RETURNS TABLE (
  retailer_id UUID,
  retailer_name TEXT,
  shop_name TEXT,
  crate_type_name TEXT,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS retailer_id,
    c.name AS retailer_name,
    c.shop_name,
    ct.name AS crate_type_name,
    COALESCE(SUM(
      CASE 
        WHEN t.transaction_type = 'issue' THEN t.quantity
        WHEN t.transaction_type = 'return' THEN -t.quantity
        WHEN t.transaction_type = 'damaged' THEN -t.quantity
        WHEN t.transaction_type = 'lost' THEN -t.quantity
        ELSE 0
      END
    ), 0)::INTEGER AS balance
  FROM public.customers c
  CROSS JOIN public.crate_types ct
  LEFT JOIN public.crate_transactions t 
    ON t.retailer_id = c.id 
    AND t.crate_type_id = ct.id
    AND t.transaction_date <= p_as_of_date
  WHERE ct.is_active = TRUE
    AND (p_crate_type_id IS NULL OR ct.id = p_crate_type_id)
  GROUP BY c.id, c.name, c.shop_name, ct.name
  HAVING COALESCE(SUM(
    CASE 
      WHEN t.transaction_type = 'issue' THEN t.quantity
      WHEN t.transaction_type = 'return' THEN -t.quantity
      WHEN t.transaction_type = 'damaged' THEN -t.quantity
      WHEN t.transaction_type = 'lost' THEN -t.quantity
      ELSE 0
    END
  ), 0) != 0
  ORDER BY c.name, ct.name;
END;
$$;
