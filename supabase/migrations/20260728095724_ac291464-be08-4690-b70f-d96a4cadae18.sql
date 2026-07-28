ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id
  ON public.customers (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id_unique
  ON public.customers (user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_customer_by_user_email(_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.link_customer_to_user(_customer_id UUID, _email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can link customers to users';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email: %', _email;
  END IF;
  UPDATE public.customers SET user_id = NULL WHERE user_id = v_user_id AND id <> _customer_id;
  UPDATE public.customers SET user_id = v_user_id WHERE id = _customer_id;
  RETURN _customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_by_user_email(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_customer_to_user(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_by_user_email(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_customer_to_user(UUID, TEXT) TO authenticated, service_role;