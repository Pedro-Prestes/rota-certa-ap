CREATE TABLE public.credenciamento_liberacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  fase1 BOOLEAN NOT NULL DEFAULT false,
  fase2 BOOLEAN NOT NULL DEFAULT false,
  fase3 BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT NOT NULL,
  liberado_por UUID,
  revogado_em TIMESTAMP WITH TIME ZONE,
  revogado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credenciamento_liberacoes TO authenticated;
GRANT ALL ON public.credenciamento_liberacoes TO service_role;

ALTER TABLE public.credenciamento_liberacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motorista ve a propria liberacao"
ON public.credenciamento_liberacoes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.eh_admin_master(auth.uid()));

CREATE POLICY "Somente master gerencia liberacoes"
ON public.credenciamento_liberacoes FOR ALL TO authenticated
USING (public.eh_admin_master(auth.uid()))
WITH CHECK (public.eh_admin_master(auth.uid()));

CREATE TRIGGER trg_credenciamento_liberacoes_updated
BEFORE UPDATE ON public.credenciamento_liberacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_credenciamento_liberacoes_user ON public.credenciamento_liberacoes (user_id);

-- Liberação manual ativa para a fase pedida
CREATE OR REPLACE FUNCTION public.credenciamento_liberado_master(_user_id uuid, _fase integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.credenciamento_liberacoes l
    WHERE l.user_id = _user_id
      AND l.revogado_em IS NULL
      AND CASE _fase WHEN 1 THEN l.fase1 WHEN 2 THEN l.fase2 ELSE l.fase3 END
  );
$$;

REVOKE ALL ON FUNCTION public.credenciamento_liberado_master(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.credenciamento_liberado_master(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.motorista_fase_liberada(_user_id uuid, _fase integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _fase <= 1 THEN true
    WHEN public.credenciamento_liberado_master(_user_id, _fase) THEN true
    WHEN _fase = 2 THEN (
      EXISTS (
        SELECT 1 FROM public.verificacoes_idoneidade v
        WHERE v.user_id = _user_id AND v.alvo = 'motorista'::public.alvo_verificacao
          AND v.status = 'aprovado'::public.status_verificacao
      )
      AND EXISTS (
        SELECT 1 FROM public.verificacoes_biometricas b
        WHERE b.user_id = _user_id AND b.status = 'aprovada'
      )
    )
    ELSE (
      public.motorista_fase_liberada(_user_id, 2)
      AND EXISTS (
        SELECT 1 FROM public.habilitacoes_motorista h
        WHERE h.user_id = _user_id AND h.status = 'aprovado'::public.status_verificacao
          AND (h.validade IS NULL OR h.validade >= CURRENT_DATE)
      )
    )
  END;
$$;