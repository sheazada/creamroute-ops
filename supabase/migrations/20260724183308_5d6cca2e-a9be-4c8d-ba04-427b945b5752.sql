
ALTER TABLE public.delivery_runs
  ADD COLUMN IF NOT EXISTS start_latitude numeric,
  ADD COLUMN IF NOT EXISTS start_longitude numeric,
  ADD COLUMN IF NOT EXISTS start_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS end_latitude numeric,
  ADD COLUMN IF NOT EXISTS end_longitude numeric,
  ADD COLUMN IF NOT EXISTS end_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS pod_latitude numeric,
  ADD COLUMN IF NOT EXISTS pod_longitude numeric,
  ADD COLUMN IF NOT EXISTS pod_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS pod_captured_at timestamptz;
