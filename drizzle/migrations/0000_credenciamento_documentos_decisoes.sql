CREATE TABLE public.credenciamento_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perfil text NOT NULL CHECK (perfil IN ('passageiro','motorista')),
  tipo text NOT NULL CHECK (tipo IN ('documento_frente','documento_verso','selfie_documento','cnh_frente','cnh_verso')),
  arquivo_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  tamanho_bytes integer NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 8388608),
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise','aprovado','correcao','rejeitado','excluido')),
  motivo text,
  decidido_por uuid,
  decidido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credenciamento_documentos TO authenticated;
GRANT ALL ON public.credenciamento_documentos TO service_role;
ALTER TABLE public.credenciamento_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Titular ve documentos de credenciamento" ON public.credenciamento_documentos FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.eh_admin_master(auth.uid()));
CREATE POLICY "Titular envia documentos de credenciamento" ON public.credenciamento_documentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'em_analise');
CREATE POLICY "Titular substitui documentos pendentes" ON public.credenciamento_documentos FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('em_analise','correcao','rejeitado')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Master gerencia documentos de credenciamento" ON public.credenciamento_documentos FOR ALL TO authenticated USING (public.eh_admin_master(auth.uid())) WITH CHECK (public.eh_admin_master(auth.uid()));
CREATE TRIGGER trg_credenciamento_documentos_updated BEFORE UPDATE ON public.credenciamento_documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.credenciamento_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perfil text NOT NULL CHECK (perfil IN ('passageiro','motorista')),
  etapa text NOT NULL CHECK (etapa IN ('biometria','documentos','cnh','veiculo','total')),
  acao text NOT NULL CHECK (acao IN ('aprovar','correcao','rejeitar','excluir','reiniciar')),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) >= 10),
  decidido_por uuid NOT NULL,
  estado_anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado_novo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credenciamento_decisoes TO authenticated;
GRANT ALL ON public.credenciamento_decisoes TO service_role;
ALTER TABLE public.credenciamento_decisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Titular ve decisoes do credenciamento" ON public.credenciamento_decisoes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.eh_admin_master(auth.uid()));
CREATE POLICY "Master registra decisoes do credenciamento" ON public.credenciamento_decisoes FOR INSERT TO authenticated WITH CHECK (public.eh_admin_master(auth.uid()) AND decidido_por = auth.uid());
CREATE INDEX cred_docs_user_status_idx ON public.credenciamento_documentos (user_id, status, created_at DESC);
CREATE INDEX cred_decisoes_user_idx ON public.credenciamento_decisoes (user_id, created_at DESC);

CREATE POLICY "Titular envia arquivos de credenciamento" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-credenciamento' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Titular ve arquivos de credenciamento" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-credenciamento' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.eh_admin_master(auth.uid())));
CREATE POLICY "Titular substitui arquivos de credenciamento" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos-credenciamento' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'documentos-credenciamento' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Titular remove arquivos de credenciamento" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos-credenciamento' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.eh_admin_master(auth.uid())));

CREATE OR REPLACE FUNCTION public.biometria_aprovada(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.verificacoes_biometricas
    WHERE user_id = user_uuid AND status = 'aprovada'
  ) OR EXISTS (
    SELECT 1 FROM public.credenciamento_decisoes
    WHERE user_id = user_uuid AND etapa = 'biometria' AND acao = 'aprovar'
      AND NOT EXISTS (
        SELECT 1 FROM public.credenciamento_decisoes posterior
        WHERE posterior.user_id = user_uuid
          AND posterior.created_at > credenciamento_decisoes.created_at
          AND posterior.etapa IN ('biometria','total')
          AND posterior.acao IN ('correcao','rejeitar','excluir','reiniciar')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.motorista_fase_liberada(_user_id uuid, _fase integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _fase <= 1 THEN true
    WHEN public.credenciamento_liberado_master(_user_id, _fase) THEN true
    WHEN _fase = 2 THEN (
      EXISTS (
        SELECT 1 FROM public.verificacoes_idoneidade v
        WHERE v.user_id = _user_id AND v.alvo = 'motorista'::public.alvo_verificacao
          AND v.status = 'aprovado'::public.status_verificacao
      )
      AND public.biometria_aprovada(_user_id)
    )
    ELSE (
      public.motorista_fase_liberada(_user_id, 2)
      AND (
        EXISTS (
          SELECT 1 FROM public.habilitacoes_motorista h
          WHERE h.user_id = _user_id AND h.status = 'aprovado'::public.status_verificacao
            AND (h.validade IS NULL OR h.validade >= CURRENT_DATE)
        )
        OR EXISTS (
          SELECT 1 FROM public.credenciamento_decisoes d
          WHERE d.user_id = _user_id AND d.etapa = 'cnh' AND d.acao = 'aprovar'
            AND NOT EXISTS (
              SELECT 1 FROM public.credenciamento_decisoes posterior
              WHERE posterior.user_id = _user_id AND posterior.created_at > d.created_at
                AND posterior.etapa IN ('cnh','total')
                AND posterior.acao IN ('correcao','rejeitar','excluir','reiniciar')
            )
        )
      )
    )
  END;
$function$;