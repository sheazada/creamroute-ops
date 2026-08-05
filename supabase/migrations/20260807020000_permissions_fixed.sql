-- Phase 2: Permissions System (FINAL - safe to run multiple times)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Create indexes (IF NOT EXISTS not available for all index types, so use DO block)
DO $$
BEGIN
  BEGIN
    CREATE INDEX idx_permissions_category ON public.permissions(category);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE INDEX idx_permissions_name ON public.permissions(name);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END;
$$;

-- Insert default permissions (skip if exists)
INSERT INTO public.permissions (name, label, description, category) VALUES
  ('place_order', 'Place Orders', 'Create new customer orders', 'orders'),
  ('view_orders', 'View Orders', 'View order list and details', 'orders'),
  ('edit_orders', 'Edit Orders', 'Modify existing orders', 'orders'),
  ('delete_orders', 'Delete Orders', 'Remove orders from system', 'orders'),
  ('create_invoice', 'Create Invoices', 'Generate invoices from orders', 'invoices'),
  ('view_invoices', 'View Invoices', 'View invoice list and details', 'invoices'),
  ('edit_invoices', 'Edit Invoices', 'Modify invoice details', 'invoices'),
  ('delete_invoices', 'Delete Invoices', 'Remove invoices', 'invoices'),
  ('download_invoice', 'Download Invoice', 'Export invoice as PDF', 'invoices'),
  ('revise_invoice', 'Revise Invoice', 'Create invoice revisions', 'invoices'),
  ('view_customers', 'View Customers', 'View customer list and profiles', 'customers'),
  ('edit_customers', 'Edit Customers', 'Modify customer details', 'customers'),
  ('delete_customers', 'Delete Customers', 'Remove customer records', 'customers'),
  ('view_ledger', 'View Ledger', 'View customer payment ledger', 'customers'),
  ('view_inventory', 'View Inventory', 'View product stock levels', 'inventory'),
  ('edit_inventory', 'Edit Inventory', 'Adjust stock levels', 'inventory'),
  ('view_products', 'View Products', 'View product catalog', 'inventory'),
  ('edit_products', 'Edit Products', 'Modify product details', 'inventory'),
  ('record_payment', 'Record Payments', 'Log customer payments', 'payments'),
  ('view_payments', 'View Payments', 'View payment history', 'payments'),
  ('reconcile_payments', 'Reconcile Payments', 'Match payments to invoices', 'payments'),
  ('view_deliveries', 'View Deliveries', 'View delivery schedule', 'deliveries'),
  ('manage_deliveries', 'Manage Deliveries', 'Create/edit delivery routes', 'deliveries'),
  ('view_reports', 'View Reports', 'Access business reports', 'reports'),
  ('export_reports', 'Export Reports', 'Download reports as CSV/PDF', 'reports'),
  ('manage_users', 'Manage Users', 'Create/edit user accounts', 'admin'),
  ('manage_roles', 'Manage Roles', 'Assign roles and permissions', 'admin'),
  ('view_audit_logs', 'View Audit Logs', 'Access system audit trail', 'admin'),
  ('manage_settings', 'Manage Settings', 'Configure business settings', 'admin'),
  ('manage_branches', 'Manage Branches', 'Create/edit branches', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Drop old function signatures (may exist with different parameter names)
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);
DROP FUNCTION IF EXISTS public.role_has_permission(text, text);
DROP FUNCTION IF EXISTS public.get_permission_id(text);

-- Helper: get permission ID by name
CREATE OR REPLACE FUNCTION public.get_permission_id(_name TEXT)
RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT id FROM public.permissions WHERE name = _name LIMIT 1;
$$;

-- Helper: check if user has a permission (cast rp.role to TEXT for enum compatibility)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role::TEXT = rp.role
    WHERE ur.user_id = _user_id
      AND rp.permission_id = public.get_permission_id(_permission_name)
  );
$$;

-- Helper: get all permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE (
  permission_name TEXT,
  permission_label TEXT,
  category TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT p.name, p.label, p.category
  FROM public.permissions p
  JOIN public.role_permissions rp ON rp.permission_id = p.id
  JOIN public.user_roles ur ON ur.role::TEXT = rp.role
  WHERE ur.user_id = _user_id;
$$;

-- Helper: check if role has a permission
CREATE OR REPLACE FUNCTION public.role_has_permission(_role TEXT, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role = _role AND p.name = _permission_name
  );
$$;

-- RLS Policies
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "permissions_insert" ON public.permissions;
CREATE POLICY "permissions_insert" ON public.permissions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_update" ON public.permissions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "permissions_delete" ON public.permissions;
CREATE POLICY "permissions_delete" ON public.permissions
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
CREATE POLICY "role_permissions_insert" ON public.role_permissions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "role_permissions_update" ON public.role_permissions;
CREATE POLICY "role_permissions_update" ON public.role_permissions
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;
CREATE POLICY "role_permissions_delete" ON public.role_permissions
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Seed role permissions (skip if exists)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE name NOT IN ('manage_users', 'manage_roles', 'manage_branches')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'salesperson', id FROM public.permissions
WHERE name IN (
  'place_order', 'view_orders', 'edit_orders',
  'create_invoice', 'view_invoices', 'edit_invoices', 'download_invoice',
  'view_customers', 'edit_customers', 'view_ledger',
  'record_payment', 'view_payments',
  'view_products', 'view_inventory'
)
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'driver', id FROM public.permissions
WHERE name IN ('view_deliveries', 'manage_deliveries', 'view_orders', 'view_customers')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'helper', id FROM public.permissions
WHERE name IN ('view_deliveries', 'manage_deliveries', 'view_orders', 'view_customers')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'retailer', id FROM public.permissions
WHERE name IN (
  'place_order', 'view_orders',
  'view_invoices', 'download_invoice',
  'view_ledger', 'record_payment'
)
ON CONFLICT (role, permission_id) DO NOTHING;
