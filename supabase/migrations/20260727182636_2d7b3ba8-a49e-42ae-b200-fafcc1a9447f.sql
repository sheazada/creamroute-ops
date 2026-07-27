INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'retailer'::app_role FROM auth.users u
WHERE u.email = 'retailer@demo.dairyflow.app'
ON CONFLICT (user_id, role) DO NOTHING;