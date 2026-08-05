
-- 1. app_settings: admin-only reads
DROP POLICY IF EXISTS app_settings_select_authenticated ON public.app_settings;
CREATE POLICY app_settings_select_admin ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Align write roles on delivery cycle / demand tables to finance (admin, manager)
DROP POLICY IF EXISTS delivery_cycles_insert ON public.delivery_cycles;
CREATE POLICY delivery_cycles_insert ON public.delivery_cycles
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS delivery_cycles_update ON public.delivery_cycles;
CREATE POLICY delivery_cycles_update ON public.delivery_cycles
  FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

DROP POLICY IF EXISTS demand_consolidations_insert ON public.demand_consolidations;
CREATE POLICY demand_consolidations_insert ON public.demand_consolidations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS demand_consolidations_update ON public.demand_consolidations;
CREATE POLICY demand_consolidations_update ON public.demand_consolidations
  FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

DROP POLICY IF EXISTS demand_consolidation_items_insert ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_insert ON public.demand_consolidation_items
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
DROP POLICY IF EXISTS demand_consolidation_items_update ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_update ON public.demand_consolidation_items
  FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

DROP POLICY IF EXISTS demand_source_orders_insert ON public.demand_source_orders;
CREATE POLICY demand_source_orders_insert ON public.demand_source_orders
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));

-- 3. Switch client-callable helper routines to SECURITY INVOKER (RLS enforces access)
CREATE OR REPLACE FUNCTION public.generate_claim_no()
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  RETURN 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $function$;

CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(p_as_of_date date DEFAULT CURRENT_DATE, p_crate_type_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(retailer_id uuid, retailer_name text, shop_name text, crate_type_id uuid, crate_type_name text, balance bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.shop_name, ct.id, ct.name,
    COALESCE(SUM(
      CASE
        WHEN t.transaction_type IN ('issue','issue_correction') THEN t.quantity
        WHEN t.transaction_type IN ('return','return_correction','damaged','lost') THEN -t.quantity
        ELSE 0
      END
    ), 0)::BIGINT
  FROM public.crate_transactions t
  JOIN public.customers c ON c.id = t.retailer_id
  JOIN public.crate_types ct ON ct.id = t.crate_type_id
  WHERE t.transaction_date <= p_as_of_date
    AND (p_crate_type_id IS NULL OR ct.id = p_crate_type_id)
  GROUP BY c.id, c.name, c.shop_name, ct.id, ct.name;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_near_expiry_stock(_days integer DEFAULT 30)
RETURNS TABLE(product_name text, batch_no text, expiry_date date, available_qty numeric, days_remaining integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY
  SELECT p.name, pb.batch_no, pb.expiry_date::DATE, pb.available_qty,
    (pb.expiry_date::DATE - CURRENT_DATE)::INT
  FROM public.product_batches pb
  JOIN public.products p ON p.id = pb.product_id
  WHERE pb.expiry_date IS NOT NULL
    AND pb.expiry_date > CURRENT_DATE
    AND pb.expiry_date <= CURRENT_DATE + (_days || ' days')::INTERVAL
    AND pb.available_qty > 0
    AND pb.status = 'active'
  ORDER BY pb.expiry_date ASC;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_stock_valuation()
RETURNS TABLE(product_id uuid, product_name text, total_qty numeric, available_qty numeric, damaged_qty numeric, avg_cost numeric, total_value numeric)
LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name,
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
END; $function$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_user_id uuid)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path TO 'public' AS $function$
  SELECT COUNT(*)::INTEGER
    FROM public.notifications
   WHERE user_id = auth.uid()
     AND (_user_id IS NULL OR _user_id = auth.uid())
     AND read_at IS NULL;
$function$;

-- 4. revise_invoice stays privileged but is no longer directly callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.revise_invoice(uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revise_invoice(uuid, text, jsonb, uuid) TO service_role;
