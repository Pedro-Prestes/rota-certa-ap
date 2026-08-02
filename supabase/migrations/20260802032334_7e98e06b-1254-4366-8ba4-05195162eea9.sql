CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê a própria assinatura" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.carteira_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('credito_compra','credito_bonus','debito_corrida','estorno','ajuste')),
  valor numeric(12,2) NOT NULL,
  descricao text,
  corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  referencia_externa text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_carteira_referencia ON public.carteira_transacoes(referencia_externa) WHERE referencia_externa IS NOT NULL;
CREATE INDEX idx_carteira_user ON public.carteira_transacoes(user_id);
GRANT SELECT ON public.carteira_transacoes TO authenticated;
GRANT ALL ON public.carteira_transacoes TO service_role;
ALTER TABLE public.carteira_transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê o próprio extrato" ON public.carteira_transacoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacoes_user ON public.notificacoes(user_id, lida);
GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê as próprias notificações" ON public.notificacoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuário marca as próprias notificações" ON public.notificacoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.saldo_carteira(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE WHEN tipo IN ('debito_corrida') THEN -valor ELSE valor END
  ), 0)::numeric(12,2)
  FROM public.carteira_transacoes
  WHERE user_id = _user_id AND environment = _env;
$$;
REVOKE ALL ON FUNCTION public.saldo_carteira(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_carteira(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tem_plano_ativo(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND environment = _env
      AND (
        (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now() AND cancel_at_period_end)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.tem_plano_ativo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_plano_ativo(uuid, text) TO authenticated, service_role;