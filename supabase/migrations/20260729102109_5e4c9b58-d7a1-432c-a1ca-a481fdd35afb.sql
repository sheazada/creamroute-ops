-- Helper: internal staff = has a role, excluding retailer roles
CREATE OR REPLACE FUNCTION public.is_internal_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','manager','salesperson','driver','helper')
  )
$$;
REVOKE ALL ON FUNCTION public.is_internal_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated, service_role;

-- crate_types
DROP POLICY IF EXISTS "Authenticated can manage crate_types" ON public.crate_types;
CREATE POLICY "crate_types_select" ON public.crate_types FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "crate_types_write" ON public.crate_types FOR ALL TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- crate_transactions
DROP POLICY IF EXISTS "Authenticated can manage crate_transactions" ON public.crate_transactions;
CREATE POLICY "crate_transactions_select" ON public.crate_transactions FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "crate_transactions_insert" ON public.crate_transactions FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "crate_transactions_update" ON public.crate_transactions FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "crate_transactions_delete" ON public.crate_transactions FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- delivery_runs
DROP POLICY IF EXISTS "delivery_runs_all" ON public.delivery_runs;
CREATE POLICY "delivery_runs_select" ON public.delivery_runs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "delivery_runs_insert" ON public.delivery_runs FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "delivery_runs_update" ON public.delivery_runs FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "delivery_runs_delete" ON public.delivery_runs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- notification_logs
DROP POLICY IF EXISTS "Team can manage notification logs" ON public.notification_logs;
CREATE POLICY "notification_logs_select" ON public.notification_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "notification_logs_insert" ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "notification_logs_update" ON public.notification_logs FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "notification_logs_delete" ON public.notification_logs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- routes
DROP POLICY IF EXISTS "routes_all" ON public.routes;
CREATE POLICY "routes_select" ON public.routes FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "routes_write" ON public.routes FOR ALL TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- route_stops
DROP POLICY IF EXISTS "route_stops_all" ON public.route_stops;
CREATE POLICY "route_stops_select" ON public.route_stops FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "route_stops_write" ON public.route_stops FOR ALL TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- supplier_payments
DROP POLICY IF EXISTS "supplier_payments_all" ON public.supplier_payments;
CREATE POLICY "supplier_payments_select" ON public.supplier_payments FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY "supplier_payments_write" ON public.supplier_payments FOR ALL TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- edit_audit_logs
DROP POLICY IF EXISTS "auth read edit audit" ON public.edit_audit_logs;
CREATE POLICY "edit_audit_logs_select" ON public.edit_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- gps_audit_logs
DROP POLICY IF EXISTS "Team can view gps audit logs" ON public.gps_audit_logs;
DROP POLICY IF EXISTS "Team can insert gps audit logs" ON public.gps_audit_logs;
CREATE POLICY "gps_audit_logs_select" ON public.gps_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "gps_audit_logs_insert" ON public.gps_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));

-- warehouses
DROP POLICY IF EXISTS "warehouses_select" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_insert" ON public.warehouses;
DROP POLICY IF EXISTS "warehouses_update" ON public.warehouses;
CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "warehouses_insert" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "warehouses_update" ON public.warehouses FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- stock_adjustments
DROP POLICY IF EXISTS "stock_adjustments_select" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_insert" ON public.stock_adjustments;
DROP POLICY IF EXISTS "stock_adjustments_update" ON public.stock_adjustments;
CREATE POLICY "stock_adjustments_select" ON public.stock_adjustments FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "stock_adjustments_insert" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "stock_adjustments_update" ON public.stock_adjustments FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- stock_adjustment_items
DROP POLICY IF EXISTS "stock_adjustment_items_select" ON public.stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_insert" ON public.stock_adjustment_items;
DROP POLICY IF EXISTS "stock_adjustment_items_update" ON public.stock_adjustment_items;
CREATE POLICY "stock_adjustment_items_select" ON public.stock_adjustment_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "stock_adjustment_items_insert" ON public.stock_adjustment_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "stock_adjustment_items_update" ON public.stock_adjustment_items FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- stock_reconciliations
DROP POLICY IF EXISTS "stock_reconciliations_select" ON public.stock_reconciliations;
DROP POLICY IF EXISTS "stock_reconciliations_insert" ON public.stock_reconciliations;
DROP POLICY IF EXISTS "stock_reconciliations_update" ON public.stock_reconciliations;
CREATE POLICY "stock_reconciliations_select" ON public.stock_reconciliations FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "stock_reconciliations_insert" ON public.stock_reconciliations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "stock_reconciliations_update" ON public.stock_reconciliations FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- stock_reconciliation_items
DROP POLICY IF EXISTS "stock_reconciliation_items_select" ON public.stock_reconciliation_items;
DROP POLICY IF EXISTS "stock_reconciliation_items_insert" ON public.stock_reconciliation_items;
DROP POLICY IF EXISTS "stock_reconciliation_items_update" ON public.stock_reconciliation_items;
CREATE POLICY "stock_reconciliation_items_select" ON public.stock_reconciliation_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "stock_reconciliation_items_insert" ON public.stock_reconciliation_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY "stock_reconciliation_items_update" ON public.stock_reconciliation_items FOR UPDATE TO authenticated
  USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));

-- Lock down SECURITY DEFINER functions: no anon execute anywhere
REVOKE EXECUTE ON FUNCTION public.generate_adjustment_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_recon_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_near_expiry_stock(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_stock_valuation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_stock_adjustment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_collection_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_consolidation_no(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_cycle_code(date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_customer_by_user_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_next_revision_no(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_reminder_been_sent(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_customer_to_user(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_collection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_demand_consolidation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_delivery_cycle(date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_claim_no() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_crate_balance_as_of(date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_access_event(text, uuid, text, text[], text[], text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revise_invoice(uuid, text, jsonb, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_sales(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_finance(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_adjustment_no() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_recon_no() TO service_role;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_collection_no() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_consolidation_no(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_cycle_code(date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_by_user_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_revision_no(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_reminder_been_sent(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_customer_to_user(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_collection(uuid) TO service_role;