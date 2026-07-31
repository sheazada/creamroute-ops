insert into public.user_roles (user_id, role)
select id, 'retailer'::app_role from auth.users where email = 'retailer@demo.dairyflow.app'
on conflict (user_id, role) do nothing;