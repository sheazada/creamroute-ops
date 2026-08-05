-- Permissions catalog
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_admin_all" ON public.permissions;
CREATE POLICY "permissions_admin_all" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "permissions_staff_read" ON public.permissions;
CREATE POLICY "permissions_staff_read" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_admin_all" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_all" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "role_permissions_staff_read" ON public.role_permissions;
CREATE POLICY "role_permissions_staff_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Seed permissions
INSERT INTO public.permissions (name, label, category) VALUES
  ('place_order','Place order','orders'),
  ('view_orders','View orders','orders'),
  ('edit_orders','Edit orders','orders'),
  ('delete_orders','Delete orders','orders'),
  ('create_invoice','Create invoice','invoices'),
  ('view_invoices','View invoices','invoices'),
  ('edit_invoices','Edit invoices','invoices'),
  ('delete_invoices','Delete invoices','invoices'),
  ('download_invoice','Download invoice','invoices'),
  ('revise_invoice','Revise invoice','invoices'),
  ('view_customers','View customers','customers'),
  ('edit_customers','Edit customers','customers'),
  ('delete_customers','Delete customers','customers'),
  ('view_ledger','View ledger','customers'),
  ('view_inventory','View inventory','inventory'),
  ('edit_inventory','Edit inventory','inventory'),
  ('view_products','View products','inventory'),
  ('edit_products','Edit products','inventory'),
  ('record_payment','Record payment','payments'),
  ('view_payments','View payments','payments'),
  ('reconcile_payments','Reconcile payments','payments'),
  ('view_deliveries','View deliveries','deliveries'),
  ('manage_deliveries','Manage deliveries','deliveries'),
  ('view_reports','View reports','reports'),
  ('export_reports','Export reports','reports'),
  ('manage_users','Manage users','admin'),
  ('manage_roles','Manage roles','admin'),
  ('view_audit_logs','View audit logs','admin'),
  ('manage_settings','Manage settings','admin'),
  ('manage_branches','Manage branches','admin')
ON CONFLICT (name) DO NOTHING;

-- Seed role -> permission defaults
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::public.app_role, id FROM public.permissions
WHERE name IN ('view_orders','edit_orders','create_invoice','view_invoices','edit_invoices','download_invoice','revise_invoice','view_customers','edit_customers','view_ledger','view_inventory','edit_inventory','view_products','edit_products','record_payment','view_payments','reconcile_payments','view_deliveries','manage_deliveries','view_reports','export_reports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'salesperson'::public.app_role, id FROM public.permissions
WHERE name IN ('place_order','view_orders','edit_orders','create_invoice','view_invoices','download_invoice','view_customers','edit_customers','view_ledger','view_products','view_inventory','record_payment')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'driver'::public.app_role, id FROM public.permissions
WHERE name IN ('view_deliveries','view_orders','record_payment')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'helper'::public.app_role, id FROM public.permissions
WHERE name IN ('view_deliveries','view_orders')
ON CONFLICT DO NOTHING;

-- RPCs
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE (permission_name text, category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.name, p.category
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role = ur.role
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id;
$$;
REVOKE ALL ON FUNCTION public.get_user_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.name = _permission_name
  );
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;