CREATE POLICY "Users manage own script files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'scripts' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'scripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own generated media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);