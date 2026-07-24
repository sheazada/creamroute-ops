
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_latitude double precision;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS start_longitude double precision;
