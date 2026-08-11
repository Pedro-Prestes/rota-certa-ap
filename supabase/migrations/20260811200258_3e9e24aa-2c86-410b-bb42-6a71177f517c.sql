CREATE POLICY "biometrias_dono_envia" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'biometrias' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "biometrias_dono_atualiza" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'biometrias' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'biometrias' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "biometrias_dono_apaga" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'biometrias' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));