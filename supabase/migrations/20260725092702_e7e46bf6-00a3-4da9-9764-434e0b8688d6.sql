
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_sales(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager','salesperson'))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager'))
$$;

-- Replace overly-permissive *_all policies

-- customers
DROP POLICY IF EXISTS customers_all ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- products
DROP POLICY IF EXISTS products_all ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- product_batches
DROP POLICY IF EXISTS batches_all ON public.product_batches;
CREATE POLICY product_batches_select ON public.product_batches FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY product_batches_insert ON public.product_batches FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY product_batches_update ON public.product_batches FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY product_batches_delete ON public.product_batches FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- inventory_movements
DROP POLICY IF EXISTS movements_all ON public.inventory_movements;
CREATE POLICY inventory_movements_select ON public.inventory_movements FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY inventory_movements_insert ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY inventory_movements_update ON public.inventory_movements FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY inventory_movements_delete ON public.inventory_movements FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- orders
DROP POLICY IF EXISTS orders_all ON public.orders;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- order_items
DROP POLICY IF EXISTS order_items_all ON public.order_items;
CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY order_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY order_items_update ON public.order_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- invoices
DROP POLICY IF EXISTS invoices_all ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- invoice_items
DROP POLICY IF EXISTS invoice_items_all ON public.invoice_items;
CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- payments
DROP POLICY IF EXISTS payments_all ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));

-- deliveries
DROP POLICY IF EXISTS deliveries_all ON public.deliveries;
CREATE POLICY deliveries_select ON public.deliveries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY deliveries_insert ON public.deliveries FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY deliveries_update ON public.deliveries FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY deliveries_delete ON public.deliveries FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- suppliers
DROP POLICY IF EXISTS suppliers_all ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- purchases
DROP POLICY IF EXISTS purchases_all ON public.purchases;
CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- purchase_items
DROP POLICY IF EXISTS purchase_items_all ON public.purchase_items;
CREATE POLICY purchase_items_select ON public.purchase_items FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));
CREATE POLICY purchase_items_insert ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY purchase_items_update ON public.purchase_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));
CREATE POLICY purchase_items_delete ON public.purchase_items FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));

-- profiles: restrict self-read
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Lock down SECURITY DEFINER functions from anon/authenticated where not needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_delivery_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_delivery_run_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_delivery_notifications(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_run_en_route_notifications(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_runs_enqueue_status_notifications() FROM PUBLIC, anon, authenticated;

-- has_role must remain callable by authenticated (used by RLS policies)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- get_crate_balance_as_of is called by the app; keep authenticated only
REVOKE EXECUTE ON FUNCTION public.get_crate_balance_as_of(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crate_balance_as_of(date, uuid) TO authenticated;

-- New helpers only callable by authenticated
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_sales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_sales(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_finance(uuid) TO authenticated;
