
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS capacity_units numeric,
  ADD COLUMN IF NOT EXISTS capacity_label text;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS received_by text,
  ADD COLUMN IF NOT EXISTS pod_photo_url text,
  ADD COLUMN IF NOT EXISTS pod_signature text,
  ADD COLUMN IF NOT EXISTS collected_amount numeric,
  ADD COLUMN IF NOT EXISTS collected_mode text,
  ADD COLUMN IF NOT EXISTS scheduled_date date;

CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries(scheduled_date);

DROP POLICY IF EXISTS "pod_read" ON storage.objects;
DROP POLICY IF EXISTS "pod_insert" ON storage.objects;
DROP POLICY IF EXISTS "pod_update" ON storage.objects;
DROP POLICY IF EXISTS "pod_delete" ON storage.objects;

CREATE POLICY "pod_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pod');
CREATE POLICY "pod_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pod');
CREATE POLICY "pod_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pod');
CREATE POLICY "pod_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pod');
