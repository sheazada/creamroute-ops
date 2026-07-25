
DROP FUNCTION IF EXISTS public.get_crate_balance_as_of(DATE);
CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(p_as_of_date DATE DEFAULT CURRENT_DATE, p_crate_type_id UUID DEFAULT NULL)
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
  WHERE t.transaction_date <= p_as_of_date
    AND (p_crate_type_id IS NULL OR ct.id = p_crate_type_id)
  GROUP BY c.id, c.name, c.shop_name, ct.id, ct.name;
$$;
