
-- 1. Storage: challans (finance only)
DROP POLICY IF EXISTS "challans staff read" ON storage.objects;
DROP POLICY IF EXISTS "challans staff insert" ON storage.objects;
DROP POLICY IF EXISTS "challans staff update" ON storage.objects;
DROP POLICY IF EXISTS "challans staff delete" ON storage.objects;

CREATE POLICY "challans finance read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'challans' AND public.can_manage_finance(auth.uid()));
CREATE POLICY "challans finance insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'challans' AND public.can_manage_finance(auth.uid()));
CREATE POLICY "challans finance update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'challans' AND public.can_manage_finance(auth.uid()))
  WITH CHECK (bucket_id = 'challans' AND public.can_manage_finance(auth.uid()));
CREATE POLICY "challans finance delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'challans' AND public.can_manage_finance(auth.uid()));

-- 2. Storage: pod (internal staff only; deletes restricted to management)
DROP POLICY IF EXISTS "pod_read" ON storage.objects;
DROP POLICY IF EXISTS "pod_insert" ON storage.objects;
DROP POLICY IF EXISTS "pod_update" ON storage.objects;
DROP POLICY IF EXISTS "pod_delete" ON storage.objects;

CREATE POLICY "pod staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pod' AND public.is_internal_staff(auth.uid()));
CREATE POLICY "pod staff insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pod' AND public.is_internal_staff(auth.uid()) AND owner = auth.uid());
CREATE POLICY "pod owner or manager update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pod' AND (owner = auth.uid() OR public.can_manage_sales(auth.uid())))
  WITH CHECK (bucket_id = 'pod' AND (owner = auth.uid() OR public.can_manage_sales(auth.uid())));
CREATE POLICY "pod manager delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pod' AND public.can_manage_sales(auth.uid()));

-- 3. delivery_runs insert restricted to management roles
DROP POLICY IF EXISTS "delivery_runs_insert" ON public.delivery_runs;
CREATE POLICY "delivery_runs_insert" ON public.delivery_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_sales(auth.uid()));

-- 4. access_audit_logs: no more WITH CHECK (true)
DROP POLICY IF EXISTS "access_audit_logs_insert" ON public.access_audit_logs;
CREATE POLICY "access_audit_logs_insert" ON public.access_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- 5. SECURITY DEFINER functions: revoke direct execution where clients never call them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_internal_staff(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_sales(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_finance(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_demand_consolidation(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_delivery_cycle(date, text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_access_event(text, uuid, text, text[], text[], text, text, text, text) FROM authenticated, anon, PUBLIC;

-- 6. Remaining client-callable definer functions: enforce in-function authorization
CREATE OR REPLACE FUNCTION public.get_stock_valuation()
 RETURNS TABLE(product_id uuid, product_name text, total_qty numeric, available_qty numeric, damaged_qty numeric, avg_cost numeric, total_value numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_near_expiry_stock(_days integer DEFAULT 30)
 RETURNS TABLE(product_name text, batch_no text, expiry_date date, available_qty numeric, days_remaining integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_claim_no()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n INT;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  RETURN 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $function$;

CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(p_as_of_date date DEFAULT CURRENT_DATE, p_crate_type_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(retailer_id uuid, retailer_name text, shop_name text, crate_type_id uuid, crate_type_name text, balance bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_stock_valuation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_near_expiry_stock(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_claim_no() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crate_balance_as_of(date, uuid) TO authenticated;
