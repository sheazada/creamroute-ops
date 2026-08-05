-- 1. app_settings: admin-only writes (RLS backstop; previously no write policies)
CREATE POLICY "app_settings_insert_admin" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "app_settings_update_admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "app_settings_delete_admin" ON public.app_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. customers.user_id may only be set/changed by admins (or service role / SECURITY DEFINER admin flows)
CREATE OR REPLACE FUNCTION public.tg_customers_guard_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL
       AND auth.uid() IS NOT NULL
       AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can link a customer record to a login account';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change the login account linked to a customer record';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_guard_user_id ON public.customers;
CREATE TRIGGER customers_guard_user_id
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_customers_guard_user_id();

REVOKE ALL ON FUNCTION public.tg_customers_guard_user_id() FROM PUBLIC, anon, authenticated;