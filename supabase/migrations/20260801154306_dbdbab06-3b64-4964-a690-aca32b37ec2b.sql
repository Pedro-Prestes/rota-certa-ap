CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'credito', 'debito', 'dinheiro');
CREATE TYPE public.status_pagamento AS ENUM ('pendente', 'pago', 'estornado', 'cancelado');

CREATE TABLE public.corridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passageiro_nome text NOT NULL DEFAULT '',
  motorista_nome text NOT NULL DEFAULT '',
  veiculo text,
  origem text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  data_corrida date NOT NULL DEFAULT current_date,
  hora_partida time,
  hora_chegada time,
  distancia_km numeric(10,2) NOT NULL DEFAULT 0,
  assentos int NOT NULL DEFAULT 1,
  bagagem_l numeric(10,2) NOT NULL DEFAULT 0,
  valor_tarifa numeric(12,2) NOT NULL DEFAULT 0,
  valor_bagagem numeric(12,2) NOT NULL DEFAULT 0,
  valor_pedagios numeric(12,2) NOT NULL DEFAULT 0,
  valor_extras numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  comissao_percentual numeric(5,2) NOT NULL DEFAULT 15,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corrida_id uuid NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forma public.forma_pagamento NOT NULL,
  status public.status_pagamento NOT NULL DEFAULT 'pago',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  taxa_percentual numeric(5,2) NOT NULL DEFAULT 0,
  parcelas int NOT NULL DEFAULT 1,
  bandeira text,
  autorizacao text,
  chave_pix text,
  valor_recebido numeric(12,2),
  troco numeric(12,2) NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parcelas_validas CHECK (parcelas BETWEEN 1 AND 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corridas TO authenticated;
GRANT ALL ON public.corridas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;

ALTER TABLE public.corridas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corridas proprias" ON public.corridas
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pagamentos proprios" ON public.pagamentos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_corridas_user ON public.corridas (user_id, data_corrida DESC);
CREATE INDEX idx_pagamentos_corrida ON public.pagamentos (corrida_id);

CREATE TRIGGER corridas_updated_at BEFORE UPDATE ON public.corridas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pagamentos_updated_at BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();