
CREATE TABLE IF NOT EXISTS public.crate_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crate_types TO authenticated;
GRANT ALL ON public.crate_types TO service_role;
ALTER TABLE public.crate_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage crate_types" ON public.crate_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.crate_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crate_type_id UUID NOT NULL REFERENCES public.crate_types(id) ON DELETE RESTRICT,
  retailer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('issue','return','damaged','lost','issue_correction','return_correction')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crate_transactions TO authenticated;
GRANT ALL ON public.crate_transactions TO service_role;
ALTER TABLE public.crate_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage crate_transactions" ON public.crate_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crate_tx_retailer ON public.crate_transactions(retailer_id);
CREATE INDEX IF NOT EXISTS idx_crate_tx_type ON public.crate_transactions(crate_type_id);
CREATE INDEX IF NOT EXISTS idx_crate_tx_date ON public.crate_transactions(transaction_date);

CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(as_of_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(retailer_id UUID, retailer_name TEXT, shop_name TEXT, crate_type_id UUID, crate_type_name TEXT, balance BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id AS retailer_id,
    c.name AS retailer_name,
    c.shop_name,
    ct.id AS crate_type_id,
    ct.name AS crate_type_name,
    COALESCE(SUM(
      CASE
        WHEN t.transaction_type IN ('issue','issue_correction') THEN t.quantity
        WHEN t.transaction_type IN ('return','return_correction','damaged','lost') THEN -t.quantity
        ELSE 0
      END
    ), 0)::BIGINT AS balance
  FROM public.crate_transactions t
  JOIN public.customers c ON c.id = t.retailer_id
  JOIN public.crate_types ct ON ct.id = t.crate_type_id
  WHERE t.transaction_date <= as_of_date
  GROUP BY c.id, c.name, c.shop_name, ct.id, ct.name;
$$;
