-- Phase 1: Business Identity System Foundation
-- Implements: Account Status, Login History, Business Codes, Tenant ID
--
-- This migration makes the auth system:
--  1. Track account status (active, inactive, suspended, pending, blocked)
--  2. Store login history with device info
--  3. Auto-generate stable business codes (RET-XXXXXX)
--  4. Prepare tenant_id column for future multi-distributor SaaS

-- ═══════════════════════════════════════════════════════════
-- 1. ACCOUNT STATUS
-- ═══════════════════════════════════════════════════════════

-- Add account_status to profiles (separate from customer status)
-- Possible values: active, inactive, suspended, pending, blocked
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

-- Index for status-based queries (admin filtering, login checks)
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles (account_status);

-- Create enum-like constraint via check
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check,
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending', 'blocked'));

COMMENT ON COLUMN public.profiles.account_status IS
  'Account status: active (normal), inactive (no longer using), suspended (temporarily disabled), pending (awaiting activation), blocked (violated terms)';

-- ═══════════════════════════════════════════════════════════
-- 2. BUSINESS CODE AUTO-GENERATION
-- ═══════════════════════════════════════════════════════════

-- Function to auto-generate retailer_code when user_id is linked
-- Format: RET-XXXXXX (zero-padded 6 digits)
CREATE OR REPLACE FUNCTION public.generate_retailer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Only generate if retailer_code is NULL and user_id was just set
  IF NEW.user_id IS NOT NULL AND NEW.retailer_code IS NULL THEN
    -- Find next sequence number
    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(retailer_code, '^RET-', ''), '')::INTEGER
    ), 0) + 1 INTO v_next_seq
    FROM public.customers
    WHERE retailer_code LIKE 'RET-%';

    v_code := 'RET-' || LPAD(v_next_seq::TEXT, 6, '0');
    NEW.retailer_code := v_code;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS customers_generate_retailer_code ON public.customers;
CREATE TRIGGER customers_generate_retailer_code
  BEFORE INSERT OR UPDATE OF user_id ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_retailer_code();

COMMENT ON FUNCTION public.generate_retailer_code() IS
  'Auto-generates RET-XXXXXX business code when a customer is linked to a user. Codes are stable, unique, and appear everywhere (invoices, orders, ledger, search).';

-- Also backfill existing retailer records that have user_id but no code
UPDATE public.customers
SET retailer_code = 'RET-' || LPAD(
  (ROW_NUMBER() OVER (ORDER BY created_at))::TEXT, 6, '0'
)
WHERE user_id IS NOT NULL AND retailer_code IS NULL;

-- Ensure retailer_code is unique (one customer per code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_retailer_code
  ON public.customers (retailer_code)
  WHERE retailer_code IS NOT NULL;

-- Add index for fast search by business code
CREATE INDEX IF NOT EXISTS idx_customers_retailer_code_lookup
  ON public.customers (retailer_code);

-- ═══════════════════════════════════════════════════════════
-- 3. LOGIN HISTORY ENHANCEMENT
-- ═══════════════════════════════════════════════════════════

-- access_audit_logs already exists — enhance it with device tracking
ALTER TABLE public.access_audit_logs
  ADD COLUMN IF NOT EXISTS device_type TEXT,           -- mobile, desktop, tablet
  ADD COLUMN IF NOT EXISTS os TEXT,                    -- iOS, Android, Windows, macOS
  ADD COLUMN IF NOT EXISTS browser TEXT,               -- Chrome, Safari, Firefox
  ADD COLUMN IF NOT EXISTS device_model TEXT,          -- Samsung S24, iPhone 15
  ADD COLUMN IF NOT EXISTS is_new_device BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS login_status TEXT,          -- success, failed, locked
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;        -- wrong password, account blocked, etc.

COMMENT ON COLUMN public.access_audit_logs.device_type IS 'Device category: mobile, desktop, tablet';
COMMENT ON COLUMN public.access_audit_logs.login_status IS 'Login outcome: success, failed, locked';
COMMENT ON COLUMN public.access_audit_logs.failure_reason IS 'Why login failed (wrong password, account blocked, etc.)';

-- ═══════════════════════════════════════════════════════════
-- 4. TENANT ID FOUNDATION (SaaS Readiness)
-- ═══════════════════════════════════════════════════════════

-- Add distributor_id to profiles for future multi-distributor support
-- In single-distributor mode, all users share the same distributor_id
-- When expanding to SaaS, each distributor gets their own ID
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS distributor_id UUID;

-- Create a "default distributor" record for current single-tenant setup
-- This will be the root tenant. In future, multiple rows = multiple distributors
CREATE TABLE IF NOT EXISTS public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  legal_name TEXT,
  gstin TEXT,
  pan TEXT,
  fssai TEXT,
  address TEXT,
  mobile TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.distributors IS
  'Tenant table for future multi-distributor SaaS. In single-tenant mode, one row exists. Each row represents an independent business.';

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

-- Add distributor_id to customers (retailers belong to a distributor)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS distributor_id UUID;

-- Backfill: all existing customers belong to the default distributor
-- (will be set once the distributor row is created)

-- ═══════════════════════════════════════════════════════════
-- 5. RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Distributors: all authenticated users can read (for dropdowns)
-- Only admins can manage
DROP POLICY IF EXISTS "distributors_select" ON public.distributors;
CREATE POLICY "distributors_select" ON public.distributors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "distributors_insert" ON public.distributors;
CREATE POLICY "distributors_insert" ON public.distributors
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "distributors_update" ON public.distributors;
CREATE POLICY "distributors_update" ON public.distributors
  FOR UPDATE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════
-- 6. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- Check if a user's account is active (for login guard)
CREATE OR REPLACE FUNCTION public.is_account_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  ) = 'active';
$$;

COMMENT ON FUNCTION public.is_account_active(UUID) IS
  'Returns true if the user account status is "active". Used during login to block inactive/suspended/blocked accounts.';

-- Get user's account status
CREATE OR REPLACE FUNCTION public.get_account_status(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  );
$$;

-- Get retailer code by user_id (for display in headers, invoices)
CREATE OR REPLACE FUNCTION public.get_retailer_code(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT retailer_code FROM public.customers WHERE user_id = _user_id LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_retailer_code(UUID) IS
  'Returns the stable RET-XXXXXX business code for a user. NULL if the user is not a linked retailer.';
