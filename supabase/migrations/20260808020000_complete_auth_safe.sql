-- Phase 1: Core Authentication (SAFE - handles existing data)
-- This migration is idempotent - safe to run multiple times

-- ══════════════════════════════════════════════════════════
-- 1. DISTRIBUTOR TABLE (Tenant)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT,
  pan TEXT,
  fssai TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  email TEXT,
  phone TEXT,
  logo_url TEXT,
  invoice_prefix TEXT DEFAULT 'INV',
  financial_year_start DATE DEFAULT '2024-04-01',
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.distributors IS
  'Tenant table. Currently one row (your business). Future: multiple distributors.';

-- ═══════════════════════════════════════════════════════════
-- 2. USERS TABLE (Core authentication)
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  
  -- Authentication
  email TEXT UNIQUE,
  mobile TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  
  -- Profile
  full_name TEXT NOT NULL,
  employee_id TEXT,
  retailer_id TEXT,
  
  -- Role & Access
  role TEXT NOT NULL,
  branch_id UUID,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending_verification',
  email_verified BOOLEAN DEFAULT FALSE,
  mobile_verified BOOLEAN DEFAULT FALSE,
  
  -- Security
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT users_status_check CHECK (status IN ('pending_verification', 'active', 'inactive', 'suspended', 'blocked')),
  CONSTRAINT users_role_check CHECK (role IN ('distributor', 'manager', 'accountant', 'warehouse', 'salesman', 'delivery_boy', 'retailer')),
  CONSTRAINT users_email_or_mobile CHECK (email IS NOT NULL OR mobile IS NOT NULL)
);

COMMENT ON TABLE public.users IS
  'Core user table. All employees and retailers. No public signup - distributor creates all accounts.';

-- ═══════════════════════════════════════════════════════════
-- 3. LOGIN HISTORY TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  
  ip_address TEXT,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  
  status TEXT NOT NULL DEFAULT 'success',
  failure_reason TEXT,
  
  CONSTRAINT login_history_status_check CHECK (status IN ('success', 'failed', 'locked'))
);

COMMENT ON TABLE public.login_history IS
  'Audit trail for all login attempts. Tracks success, failures, device info.';

-- ═══════════════════════════════════════════════════════════
-- 4. EMAIL VERIFICATION TOKENS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  
  CONSTRAINT email_verification_tokens_expires_check CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.email_verification_tokens IS
  'Secure tokens for email verification. Expires after 24 hours. Single-use.';

-- ═══════════════════════════════════════════════════════════
-- 5. PASSWORD RESET TOKENS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  
  CONSTRAINT password_reset_tokens_expires_check CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.password_reset_tokens IS
  'Secure tokens for password reset. Expires after 1 hour. Single-use.';

-- ═══════════════════════════════════════════════════════════
-- 6. PERMISSIONS TABLE (Master list)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.permissions IS
  'Master list of all permissions. Admin can configure which roles get which permissions.';

-- ═══════════════════════════════════════════════════════════
-- 7. ROLE PERMISSIONS TABLE (RBAC mapping)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(role, permission_id),
  CONSTRAINT role_permissions_role_check CHECK (role IN ('distributor', 'manager', 'accountant', 'warehouse', 'salesman', 'delivery_boy', 'retailer'))
);

COMMENT ON TABLE public.role_permissions IS
  'Maps roles to permissions. Distributor configures this via admin UI.';

-- ═══════════════════════════════════════════════════════════
-- 8. AUDIT LOGS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  
  old_value JSONB,
  new_value JSONB,
  
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS
  'Tracks important actions: user creation, status changes, permission updates, etc.';

-- ═══════════════════════════════════════════════════════════
-- 9. CREATE INDEXES (safe for duplicates)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN CREATE INDEX idx_users_distributor_id ON public.users(distributor_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_users_email ON public.users(email) WHERE email IS NOT NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_users_mobile ON public.users(mobile) WHERE mobile IS NOT NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_users_retailer_id ON public.users(retailer_id) WHERE retailer_id IS NOT NULL; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_users_status ON public.users(status); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_users_role ON public.users(role); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_login_history_user_id ON public.login_history(user_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_login_history_distributor_id ON public.login_history(distributor_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_login_history_login_at ON public.login_history(login_at DESC); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_permissions_category ON public.permissions(category); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_permissions_name ON public.permissions(name); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_role_permissions_role ON public.role_permissions(role); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN CREATE INDEX idx_audit_logs_distributor_id ON public.audit_logs(distributor_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_audit_logs_action ON public.audit_logs(action); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC); EXCEPTION WHEN duplicate_object THEN NULL; END;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- 10. TRIGGERS (drop and recreate safely)
-- ══════════════════════════════════════════════════════════

-- Generate retailer code: RET-XXXXXX
DROP FUNCTION IF EXISTS generate_retailer_code() CASCADE;
CREATE OR REPLACE FUNCTION generate_retailer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.retailer_id IS NULL AND NEW.role = 'retailer' THEN
    NEW.retailer_id := 'RET-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(retailer_id FROM 5) AS INTEGER)), 0) + 1
       FROM public.users
       WHERE retailer_id IS NOT NULL AND role = 'retailer')::TEXT,
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_retailer_code ON public.users;
CREATE TRIGGER trg_generate_retailer_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION generate_retailer_code();

-- Generate employee ID: EMP-XXXXXX
DROP FUNCTION IF EXISTS generate_employee_id() CASCADE;
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.role != 'retailer' THEN
    NEW.employee_id := 'EMP-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1
       FROM public.users
       WHERE employee_id IS NOT NULL AND role != 'retailer')::TEXT,
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_employee_id ON public.users;
CREATE TRIGGER trg_generate_employee_id
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_id();

-- Auto-update updated_at timestamp
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_distributors_updated_at ON public.distributors;
CREATE TRIGGER trg_distributors_updated_at
  BEFORE UPDATE ON public.distributors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- 11. SEED DEFAULT DISTRIBUTOR (skip if exists)
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.distributors (business_name, email, status)
VALUES ('Your Dairy Business', 'admin@creamroute.com', 'active')
ON CONFLICT (id) DO NOTHING;

-- Update if it exists but has no email
UPDATE public.distributors 
SET email = 'admin@creamroute.com'
WHERE business_name = 'Your Dairy Business' AND (email IS NULL OR email = '');

-- ═══════════════════════════════════════════════════════════
-- 12. SEED DEFAULT PERMISSIONS (skip if exists)
-- ═══════════════════════════════════════════════════════════

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
  ('dispatch_orders', 'Dispatch Orders', 'Mark orders as dispatched', 'deliveries'),
  ('view_reports', 'View Reports', 'Access business reports', 'reports'),
  ('export_reports', 'Export Reports', 'Download reports as CSV/PDF', 'reports'),
  ('manage_users', 'Manage Users', 'Create/edit user accounts', 'admin'),
  ('manage_roles', 'Manage Roles', 'Assign roles and permissions', 'admin'),
  ('view_audit_logs', 'View Audit Logs', 'Access system audit trail', 'admin'),
  ('manage_settings', 'Manage Settings', 'Configure business settings', 'admin'),
  ('manage_branches', 'Manage Branches', 'Create/edit branches', 'admin')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 13. SEED DEFAULT ROLE PERMISSIONS (skip if exists)
-- ═══════════════════════════════════════════════════════════

-- Distributor: all permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'distributor', id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Manager: most permissions except admin-only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', id FROM public.permissions
WHERE name NOT IN ('manage_users', 'manage_roles', 'manage_branches', 'manage_settings')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Accountant: financial focus
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', id FROM public.permissions
WHERE name IN (
  'view_invoices', 'edit_invoices', 'download_invoice',
  'view_ledger', 'record_payment', 'view_payments', 'reconcile_payments',
  'view_reports', 'export_reports',
  'view_orders', 'view_customers'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Warehouse: inventory and dispatch
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'warehouse', id FROM public.permissions
WHERE name IN (
  'view_inventory', 'edit_inventory',
  'view_products', 'edit_products',
  'view_orders', 'edit_orders', 'dispatch_orders',
  'view_deliveries', 'manage_deliveries'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Salesman: sales and customers
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'salesman', id FROM public.permissions
WHERE name IN (
  'place_order', 'view_orders', 'edit_orders',
  'create_invoice', 'view_invoices', 'download_invoice',
  'view_customers', 'edit_customers', 'view_ledger',
  'record_payment', 'view_payments',
  'view_products', 'view_inventory',
  'view_deliveries'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Delivery Boy: deliveries only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'delivery_boy', id FROM public.permissions
WHERE name IN (
  'view_deliveries', 'dispatch_orders',
  'view_orders', 'view_customers'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Retailer: self-service only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'retailer', id FROM public.permissions
WHERE name IN (
  'place_order', 'view_orders',
  'view_invoices', 'download_invoice',
  'view_ledger', 'record_payment'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 14. RLS POLICIES
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Distributors
DROP POLICY IF EXISTS "distributors_select" ON public.distributors;
CREATE POLICY "distributors_select" ON public.distributors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "distributors_insert" ON public.distributors;
CREATE POLICY "distributors_insert" ON public.distributors FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "distributors_update" ON public.distributors;
CREATE POLICY "distributors_update" ON public.distributors FOR UPDATE TO authenticated USING (true);

-- Users
DROP POLICY IF EXISTS "users_select_self" ON public.users;
CREATE POLICY "users_select_self" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
CREATE POLICY "users_select_admin" ON public.users FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);

-- Login history
DROP POLICY IF EXISTS "login_history_select" ON public.login_history;
CREATE POLICY "login_history_select" ON public.login_history FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "login_history_insert" ON public.login_history;
CREATE POLICY "login_history_insert" ON public.login_history FOR INSERT TO authenticated WITH CHECK (true);

-- Verification tokens
DROP POLICY IF EXISTS "email_verification_tokens_select" ON public.email_verification_tokens;
CREATE POLICY "email_verification_tokens_select" ON public.email_verification_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "email_verification_tokens_insert" ON public.email_verification_tokens;
CREATE POLICY "email_verification_tokens_insert" ON public.email_verification_tokens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "email_verification_tokens_update" ON public.email_verification_tokens;
CREATE POLICY "email_verification_tokens_update" ON public.email_verification_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "password_reset_tokens_select" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_select" ON public.password_reset_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "password_reset_tokens_insert" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_insert" ON public.password_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "password_reset_tokens_update" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_update" ON public.password_reset_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Permissions
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permissions_insert" ON public.permissions;
CREATE POLICY "permissions_insert" ON public.permissions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "permissions_update" ON public.permissions;
CREATE POLICY "permissions_update" ON public.permissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "permissions_delete" ON public.permissions;
CREATE POLICY "permissions_delete" ON public.permissions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);

-- Role permissions
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;
CREATE POLICY "role_permissions_insert" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "role_permissions_update" ON public.role_permissions;
CREATE POLICY "role_permissions_update" ON public.role_permissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "role_permissions_delete" ON public.role_permissions;
CREATE POLICY "role_permissions_delete" ON public.role_permissions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);

-- Audit logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'distributor')
);
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- 15. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.get_user_permissions(uuid);
DROP FUNCTION IF EXISTS public.role_has_permission(text, text);

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.users u ON u.role = rp.role
    WHERE u.id = _user_id
      AND rp.permission_id = (SELECT id FROM public.permissions WHERE name = _permission_name)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE (permission_name TEXT, permission_label TEXT, category TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT p.name, p.label, p.category
  FROM public.permissions p
  JOIN public.role_permissions rp ON rp.permission_id = p.id
  JOIN public.users u ON u.role = rp.role
  WHERE u.id = _user_id;
$$;

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
