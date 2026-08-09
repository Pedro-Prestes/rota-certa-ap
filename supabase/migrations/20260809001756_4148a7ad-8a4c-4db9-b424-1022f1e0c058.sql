-- Configuração da campanha
CREATE TABLE public.promo_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  vagas_por_uf integer NOT NULL DEFAULT 10,
  price_id text NOT NULL DEFAULT 'motorista_pro_mensal',
  dias integer NOT NULL DEFAULT 30,
  ativa boolean NOT NULL DEFAULT true,
  vigencia_inicio timestamptz NOT NULL DEFAULT now(),
  vigencia_fim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_config TO anon;
GRANT SELECT, UPDATE ON public.promo_config TO authenticated;
GRANT ALL ON public.promo_config TO service_role;
ALTER TABLE public.promo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_config_leitura_publica" ON public.promo_config
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "promo_config_gestao_atualiza" ON public.promo_config
  FOR UPDATE TO authenticated
  USING (public.eh_gestao(auth.uid())) WITH CHECK (public.eh_gestao(auth.uid()));

CREATE TRIGGER trg_promo_config_updated BEFORE UPDATE ON public.promo_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.promo_config (chave) VALUES ('lancamento_motorista');

-- Vagas concedidas
CREATE TABLE public.promo_lancamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uf text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL,
  assinatura_id uuid REFERENCES public.assinaturas_carteira(id) ON DELETE SET NULL,
  posicao integer NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  environment text NOT NULL DEFAULT 'live',
  concedida_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX promo_lancamento_uf_posicao_key ON public.promo_lancamento (uf, posicao);
CREATE UNIQUE INDEX promo_lancamento_user_key ON public.promo_lancamento (user_id);

GRANT SELECT ON public.promo_lancamento TO authenticated;
GRANT ALL ON public.promo_lancamento TO service_role;
ALTER TABLE public.promo_lancamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_lancamento_proprio" ON public.promo_lancamento
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "promo_lancamento_colaboradores" ON public.promo_lancamento
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));

CREATE TRIGGER trg_promo_lancamento_updated BEFORE UPDATE ON public.promo_lancamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marca o período de cortesia nas assinaturas pagas com créditos
ALTER TABLE public.assinaturas_carteira
  ADD COLUMN promocional boolean NOT NULL DEFAULT false;

-- Vagas restantes por UF (sem expor usuários)
CREATE OR REPLACE FUNCTION public.promo_vagas_restantes()
RETURNS TABLE(uf text, usadas integer, restantes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT vagas_por_uf, ativa FROM public.promo_config WHERE chave = 'lancamento_motorista' LIMIT 1
  ),
  ufs AS (
    SELECT unnest(ARRAY['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']) AS uf
  )
  SELECT u.uf,
         COALESCE(c.qtd, 0)::int AS usadas,
         GREATEST((SELECT vagas_por_uf FROM cfg) - COALESCE(c.qtd, 0), 0)::int AS restantes
  FROM ufs u
  LEFT JOIN (
    SELECT p.uf, count(*) AS qtd FROM public.promo_lancamento p GROUP BY p.uf
  ) c ON c.uf = u.uf
  ORDER BY u.uf;
$$;

REVOKE ALL ON FUNCTION public.promo_vagas_restantes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promo_vagas_restantes() TO anon, authenticated, service_role;