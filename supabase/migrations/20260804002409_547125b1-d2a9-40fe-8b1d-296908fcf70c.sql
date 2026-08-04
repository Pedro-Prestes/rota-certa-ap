ALTER TABLE public.carteira_transacoes DROP CONSTRAINT IF EXISTS carteira_transacoes_tipo_check;
ALTER TABLE public.carteira_transacoes ADD CONSTRAINT carteira_transacoes_tipo_check CHECK (tipo = ANY (ARRAY['credito_compra','credito_bonus','debito_corrida','debito_assinatura','estorno','ajuste']));

CREATE OR REPLACE FUNCTION public.saldo_carteira(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('debito_corrida','debito_assinatura') THEN -valor ELSE valor END
  ), 0)::numeric(12,2)
  FROM public.carteira_transacoes
  WHERE user_id = _user_id AND environment = _env;
$$;
REVOKE ALL ON FUNCTION public.saldo_carteira(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saldo_carteira(uuid, text) TO service_role;

CREATE TABLE public.assinaturas_carteira (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_id text NOT NULL,
  valor_mensal numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','inadimplente','cancelada')),
  periodo_inicio timestamptz NOT NULL DEFAULT now(),
  periodo_fim timestamptz NOT NULL,
  proxima_cobranca timestamptz NOT NULL,
  cancelar_no_fim boolean NOT NULL DEFAULT false,
  tentativas integer NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assinaturas_carteira_user ON public.assinaturas_carteira(user_id, environment);
CREATE INDEX idx_assinaturas_carteira_cobranca ON public.assinaturas_carteira(proxima_cobranca) WHERE status IN ('ativa','inadimplente');

GRANT SELECT ON public.assinaturas_carteira TO authenticated;
GRANT ALL ON public.assinaturas_carteira TO service_role;

ALTER TABLE public.assinaturas_carteira ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê a própria assinatura de carteira"
ON public.assinaturas_carteira FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_assinaturas_carteira_updated_at
BEFORE UPDATE ON public.assinaturas_carteira
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.tem_plano_carteira_ativo(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assinaturas_carteira
    WHERE user_id = _user_id AND environment = _env
      AND status = 'ativa' AND periodo_fim > now()
  );
$$;
REVOKE ALL ON FUNCTION public.tem_plano_carteira_ativo(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tem_plano_carteira_ativo(uuid, text) TO service_role;