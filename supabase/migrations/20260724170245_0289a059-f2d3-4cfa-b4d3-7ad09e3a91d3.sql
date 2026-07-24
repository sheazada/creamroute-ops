
CREATE POLICY "challans staff read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'challans');

CREATE POLICY "challans staff insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'challans');

CREATE POLICY "challans staff update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'challans') WITH CHECK (bucket_id = 'challans');

CREATE POLICY "challans staff delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'challans');
