CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::INTEGER
    FROM public.notifications
   WHERE user_id = auth.uid()
     AND (_user_id IS NULL OR _user_id = auth.uid())
     AND read_at IS NULL;
$function$;
REVOKE ALL ON FUNCTION public.get_unread_notification_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(uuid) TO authenticated, service_role;
