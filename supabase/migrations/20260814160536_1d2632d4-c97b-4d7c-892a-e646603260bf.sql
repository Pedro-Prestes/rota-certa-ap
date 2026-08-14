-- 1) Documentos de conformidade da pessoa jurídica
CREATE TABLE public.pj_conformidade (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_entidade text NOT NULL CHECK (tipo_entidade IN ('cooperativa','frotista')),
  entidade_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  numero text,
  orgao_emissor text,
  validade date,
  status public.status_verificacao NOT NULL DEFAULT 'pendente',
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo_entidade, entidade_id, tipo_documento)
);

CREATE INDEX pj_conformidade_entidade_idx ON public.pj_conformidade (tipo_entidade, entidade_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pj_conformidade TO authenticated;
GRANT ALL ON public.pj_conformidade TO service_role;

ALTER TABLE public.pj_conformidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PJ gerencia seus documentos"
ON public.pj_conformidade FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Equipe administrativa ve documentos PJ"
ON public.pj_conformidade FOR SELECT TO authenticated
USING (public.eh_colaborador(auth.uid()));

CREATE POLICY "Gestao avalia documentos PJ"
ON public.pj_conformidade FOR UPDATE TO authenticated
USING (public.eh_gestao(auth.uid()))
WITH CHECK (public.eh_gestao(auth.uid()));

CREATE TRIGGER trg_pj_conformidade_updated
BEFORE UPDATE ON public.pj_conformidade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Situação do credenciamento nas entidades
ALTER TABLE public.cooperativas
  ADD COLUMN IF NOT EXISTS fase_atual integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_conformidade integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verificada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliada_em timestamptz;

ALTER TABLE public.frotistas
  ADD COLUMN IF NOT EXISTS fase_atual integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_conformidade integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verificada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliada_em timestamptz;

-- 3) Liberação de fases da PJ
CREATE OR REPLACE FUNCTION public.pj_documento_ok(_tipo_entidade text, _entidade_id uuid, _tipo_documento text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pj_conformidade d
    WHERE d.tipo_entidade = _tipo_entidade
      AND d.entidade_id = _entidade_id
      AND d.tipo_documento = _tipo_documento
      AND d.status = 'aprovado'::public.status_verificacao
      AND (d.validade IS NULL OR d.validade >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION public.pj_fase_liberada(_tipo_entidade text, _entidade_id uuid, _fase integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF _fase <= 1 THEN RETURN true; END IF;

  IF _tipo_entidade = 'cooperativa' THEN
    SELECT user_id INTO v_user FROM public.cooperativas WHERE id = _entidade_id;
  ELSE
    SELECT user_id INTO v_user FROM public.frotistas WHERE id = _entidade_id;
  END IF;
  IF v_user IS NULL THEN RETURN false; END IF;

  -- Fase 2: empresa identificada (CNPJ) + biometria facial do responsável legal
  IF NOT (
    public.pj_documento_ok(_tipo_entidade, _entidade_id, 'cnpj')
    AND public.biometria_aprovada(v_user)
  ) THEN
    RETURN false;
  END IF;

  IF _fase = 2 THEN RETURN true; END IF;

  -- Fase 3: documentos de conformidade específicos do perfil
  IF _tipo_entidade = 'cooperativa' THEN
    RETURN public.pj_documento_ok(_tipo_entidade, _entidade_id, 'ato_constitutivo')
       AND public.pj_documento_ok(_tipo_entidade, _entidade_id, 'alvara');
  END IF;

  RETURN public.pj_documento_ok(_tipo_entidade, _entidade_id, 'alvara')
     AND public.pj_documento_ok(_tipo_entidade, _entidade_id, 'seguro_rcfv');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pj_documento_ok(text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pj_fase_liberada(text, uuid, integer) FROM anon;

-- 4) Veículo de frotista exige fases 1 e 2 da empresa
CREATE OR REPLACE FUNCTION public.exigir_fases_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.user_id, 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.frotista_id IS NOT NULL THEN
    IF NOT public.pj_fase_liberada('frotista', NEW.frotista_id, 3) THEN
      RAISE EXCEPTION 'Conclua as fases 1 e 2 do credenciamento da empresa (CNPJ e biometria do responsável) antes de cadastrar o veículo.';
    END IF;
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.user_id, 'frotista'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NOT public.motorista_fase_liberada(NEW.user_id, 3) THEN
    RAISE EXCEPTION 'Conclua as fases anteriores (idoneidade + biometria facial e habilitação aprovada) antes de cadastrar o veículo.';
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Vínculo de motorista à cooperativa exige as fases de ambos
CREATE OR REPLACE FUNCTION public.exigir_fases_vinculo_cooperativa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'ativo' THEN RETURN NEW; END IF;

  IF NOT public.pj_fase_liberada('cooperativa', NEW.cooperativa_id, 3) THEN
    RAISE EXCEPTION 'A cooperativa precisa concluir as fases 1 e 2 do credenciamento antes de vincular motoristas.';
  END IF;

  IF NOT public.motorista_fase_liberada(NEW.motorista_id, 3) THEN
    RAISE EXCEPTION 'O motorista precisa ter idoneidade, biometria facial e CNH aprovadas para ser vinculado.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coop_motoristas_fases
BEFORE INSERT OR UPDATE ON public.cooperativa_motoristas
FOR EACH ROW EXECUTE FUNCTION public.exigir_fases_vinculo_cooperativa();

-- 6) Selo de verificação visível ao público
CREATE POLICY "Selo publico de cooperativas ativas"
ON public.cooperativas FOR SELECT TO anon
USING (status = 'ativa' AND verificada = true);

GRANT SELECT ON public.cooperativas TO anon;