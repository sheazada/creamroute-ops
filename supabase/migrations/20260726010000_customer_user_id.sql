-- Link retailer auth users to customer records.
-- Allows the retailer portal to look up the logged-in user's shop, orders, and ledger.

-- 1. Add user_id column (nullable — walk-in customers may not have an auth user)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index for portal lookup (single-column)
CREATE INDEX IF NOT EXISTS idx_customers_user_id
  ON public.customers (user_id);

-- 3. Partial unique index: each auth user can be linked to at most ONE customer.
-- Walk-in customers (user_id IS NULL) are exempt from uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id_unique
  ON public.customers (user_id)
  WHERE user_id IS NOT NULL;

-- 4. Helper: given an email, return the customer.id linked to it (via auth.users).
-- Used by seed functions.
CREATE OR REPLACE FUNCTION public.get_customer_by_user_email(_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_customer_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_user_id LIMIT 1;
  RETURN v_customer_id;
END;
$$;

-- 5. Helper: link an existing customer to an auth user by email.
-- Returns the customer id (or NULL if email/user not found).
CREATE OR REPLACE FUNCTION public.link_customer_to_user(_customer_id UUID, _email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email: %', _email;
  END IF;
  -- Unlink any other customer that might have been linked to this user
  UPDATE public.customers SET user_id = NULL WHERE user_id = v_user_id AND id <> _customer_id;
  -- Link this customer
  UPDATE public.customers SET user_id = v_user_id WHERE id = _customer_id;
  RETURN _customer_id;
END;
$$;
