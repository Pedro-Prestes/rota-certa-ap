CREATE TABLE public.avaliacoes_motorista (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passageiro_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL,
  corrida_urbana_id uuid REFERENCES public.corridas_urbanas(id) ON DELETE SET NULL,
  nota smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX avaliacoes_motorista_unica_rota
  ON public.avaliacoes_motorista (passageiro_id, motorista_id, rota_id)
  WHERE rota_id IS NOT NULL;
CREATE UNIQUE INDEX avaliacoes_motorista_unica_urbana
  ON public.avaliacoes_motorista (passageiro_id, corrida_urbana_id)
  WHERE corrida_urbana_id IS NOT NULL;
CREATE INDEX avaliacoes_motorista_motorista_idx ON public.avaliacoes_motorista (motorista_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_motorista TO authenticated;
GRANT ALL ON public.avaliacoes_motorista TO service_role;

ALTER TABLE public.avaliacoes_motorista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passageiro gerencia suas avaliacoes"
  ON public.avaliacoes_motorista FOR ALL TO authenticated
  USING (passageiro_id = auth.uid())
  WITH CHECK (passageiro_id = auth.uid() AND motorista_id <> auth.uid());

CREATE POLICY "Motorista ve avaliacoes recebidas"
  ON public.avaliacoes_motorista FOR SELECT TO authenticated
  USING (motorista_id = auth.uid());

CREATE POLICY "Gestao ve avaliacoes"
  ON public.avaliacoes_motorista FOR SELECT TO authenticated
  USING (public.eh_colaborador(auth.uid()));

CREATE TRIGGER trg_avaliacoes_motorista_updated
  BEFORE UPDATE ON public.avaliacoes_motorista
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.motoristas_das_rotas(_rota_ids uuid[])
RETURNS TABLE(rota_id uuid, motorista_nome text, media numeric, total integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         COALESCE(NULLIF(split_part(COALESCE(p.nome_completo, ''), ' ', 1), ''), 'Motorista parceiro') AS motorista_nome,
         ROUND(COALESCE(a.media, 0)::numeric, 2) AS media,
         COALESCE(a.total, 0)::int AS total
  FROM public.rotas r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN (
    SELECT motorista_id, AVG(nota) AS media, COUNT(*) AS total
    FROM public.avaliacoes_motorista GROUP BY motorista_id
  ) a ON a.motorista_id = r.user_id
  WHERE r.id = ANY(_rota_ids);
$$;

REVOKE ALL ON FUNCTION public.motoristas_das_rotas(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.motoristas_das_rotas(uuid[]) TO anon, authenticated, service_role;