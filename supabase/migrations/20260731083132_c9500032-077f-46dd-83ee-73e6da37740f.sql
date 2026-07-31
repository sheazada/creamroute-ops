-- 1) Fix always-true INSERT policy on notifications (spoofing)
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.can_manage_sales(auth.uid()));

-- 2) Pin search_path on functions missing it
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER FROM public.notifications WHERE user_id = _user_id AND read_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_app_setting(_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT value FROM public.app_settings WHERE key = _key LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.send_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (_user_id, _type, _title, _body, _data) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END; $function$;

-- 3) Remove anon/authenticated EXECUTE on privileged definer helpers
REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_app_setting(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_unread_notification_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_app_setting(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) TO authenticated, service_role;
