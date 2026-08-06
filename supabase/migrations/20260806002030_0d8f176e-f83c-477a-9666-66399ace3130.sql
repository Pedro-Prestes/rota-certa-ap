-- blockchain_blocos: restrict reads
DROP POLICY IF EXISTS "blocos_leitura_autenticada" ON public.blockchain_blocos;
CREATE POLICY "blocos_leitura_envolvidos" ON public.blockchain_blocos
FOR SELECT TO authenticated
USING (
  registrado_por = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.corridas c WHERE c.id = blockchain_blocos.corrida_id AND c.user_id = auth.uid())
);

-- trajetos: restrict reads
DROP POLICY IF EXISTS "trajetos_leitura_autenticada" ON public.trajetos;
CREATE POLICY "trajetos_leitura_envolvidos" ON public.trajetos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.corridas c WHERE c.id = trajetos.corrida_id AND c.user_id = auth.uid())
);

-- plataforma_config: admin only reads
DROP POLICY IF EXISTS "cfg_leitura_autenticada" ON public.plataforma_config;
CREATE POLICY "cfg_leitura_admin" ON public.plataforma_config
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- rotas: only active routes are browsable
DROP POLICY IF EXISTS "Rotas publicadas visiveis" ON public.rotas;
CREATE POLICY "Rotas ativas visiveis" ON public.rotas
FOR SELECT TO authenticated
USING (status = 'ativa');

-- storage: owner-scoped access to biometric files
CREATE POLICY "biometrias_dono_le" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'biometrias'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- SECURITY DEFINER functions: least privilege
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.biometria_aprovada(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.frotista_liberado(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.saida_protegida(uuid, date, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.saldo_carteira(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tem_plano_ativo(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tem_plano_carteira_ativo(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pode_ver_viagem(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_ver_viagem(uuid, uuid) TO authenticated, service_role;