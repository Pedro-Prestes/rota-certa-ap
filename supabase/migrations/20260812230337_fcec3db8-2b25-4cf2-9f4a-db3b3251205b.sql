-- Perfil de acesso da cooperativa
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cooperativa';

-- Pontos percentuais da taxa administrativa destinados à cooperativa
ALTER TABLE public.plataforma_config
  ADD COLUMN IF NOT EXISTS rateio_cooperativa_percentual numeric NOT NULL DEFAULT 3;

/* ------------------------------------------------------------ tarifas urbanas */
CREATE TABLE public.tarifas_urbanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio text NOT NULL,
  uf text NOT NULL,
  bandeirada numeric NOT NULL DEFAULT 5.50,
  valor_km numeric NOT NULL DEFAULT 2.20,
  valor_minuto numeric NOT NULL DEFAULT 0.35,
  minimo numeric NOT NULL DEFAULT 9.00,
  fator_pico numeric NOT NULL DEFAULT 1.3,
  taxa_cancelamento numeric NOT NULL DEFAULT 5.00,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uf, municipio)
);
GRANT SELECT ON public.tarifas_urbanas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas_urbanas TO authenticated;
GRANT ALL ON public.tarifas_urbanas TO service_role;
ALTER TABLE public.tarifas_urbanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarifas_urbanas_leitura_publica" ON public.tarifas_urbanas
  FOR SELECT USING (true);
CREATE POLICY "tarifas_urbanas_admin_gerencia" ON public.tarifas_urbanas
  FOR ALL TO authenticated
  USING (public.eh_gestao(auth.uid())) WITH CHECK (public.eh_gestao(auth.uid()));
CREATE TRIGGER trg_tarifas_urbanas_updated BEFORE UPDATE ON public.tarifas_urbanas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

/* --------------------------------------------------------- motoristas urbanos */
CREATE TABLE public.motoristas_urbanos (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  online boolean NOT NULL DEFAULT false,
  municipio text,
  uf text,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ultima_latitude numeric,
  ultima_longitude numeric,
  ultima_posicao_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motoristas_urbanos TO authenticated;
GRANT ALL ON public.motoristas_urbanos TO service_role;
ALTER TABLE public.motoristas_urbanos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motoristas_urbanos_proprio" ON public.motoristas_urbanos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "motoristas_urbanos_gestao_le" ON public.motoristas_urbanos
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE TRIGGER trg_motoristas_urbanos_updated BEFORE UPDATE ON public.motoristas_urbanos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

/* -------------------------------------------------------------- cooperativas */
CREATE TABLE public.cooperativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj text NOT NULL UNIQUE,
  razao_social text NOT NULL,
  nome_fantasia text,
  responsavel_nome text NOT NULL,
  email_contato text,
  telefone text,
  municipio text,
  uf text,
  titular_nome text NOT NULL,
  titular_documento text NOT NULL,
  banco_codigo text,
  banco_nome text,
  tipo_conta text CHECK (tipo_conta IN ('CHECKING','SAVINGS')),
  agencia text,
  conta text,
  pix_tipo text CHECK (pix_tipo IN ('CNPJ','CPF','EMAIL','PHONE','RANDOM')),
  pix_chave text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pendente','suspensa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cooperativas TO authenticated;
GRANT ALL ON public.cooperativas TO service_role;
ALTER TABLE public.cooperativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooperativas_responsavel" ON public.cooperativas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cooperativas_gestao_le" ON public.cooperativas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "cooperativas_admin_gerencia" ON public.cooperativas
  FOR ALL TO authenticated
  USING (public.eh_admin_master(auth.uid())) WITH CHECK (public.eh_admin_master(auth.uid()));
CREATE TRIGGER trg_cooperativas_updated BEFORE UPDATE ON public.cooperativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.eh_responsavel_cooperativa(_cooperativa_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cooperativas c WHERE c.id = _cooperativa_id AND c.user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.eh_responsavel_cooperativa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_responsavel_cooperativa(uuid, uuid) TO authenticated, service_role;

/* --------------------------------------------------- vínculo com motoristas */
CREATE TABLE public.cooperativa_motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperativa_id uuid NOT NULL REFERENCES public.cooperativas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cooperativa_id, motorista_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cooperativa_motoristas TO authenticated;
GRANT ALL ON public.cooperativa_motoristas TO service_role;
ALTER TABLE public.cooperativa_motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_motoristas_responsavel" ON public.cooperativa_motoristas
  FOR ALL TO authenticated
  USING (public.eh_responsavel_cooperativa(cooperativa_id, auth.uid()))
  WITH CHECK (public.eh_responsavel_cooperativa(cooperativa_id, auth.uid()));
CREATE POLICY "coop_motoristas_proprio_le" ON public.cooperativa_motoristas
  FOR SELECT TO authenticated USING (auth.uid() = motorista_id);
CREATE POLICY "coop_motoristas_gestao_le" ON public.cooperativa_motoristas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE TRIGGER trg_coop_motoristas_updated BEFORE UPDATE ON public.cooperativa_motoristas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.cooperativa_do_motorista(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cm.cooperativa_id
  FROM public.cooperativa_motoristas cm
  JOIN public.cooperativas c ON c.id = cm.cooperativa_id
  WHERE cm.motorista_id = _user_id AND cm.status = 'ativo' AND c.status = 'ativa'
  ORDER BY cm.created_at ASC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.cooperativa_do_motorista(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cooperativa_do_motorista(uuid) TO authenticated, service_role;

/* --------------------------------------------------- carteira da cooperativa */
CREATE TABLE public.cooperativa_carteira (
  cooperativa_id uuid PRIMARY KEY REFERENCES public.cooperativas(id) ON DELETE CASCADE,
  saldo_disponivel numeric NOT NULL DEFAULT 0,
  saldo_repassado numeric NOT NULL DEFAULT 0,
  moeda text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cooperativa_carteira TO authenticated;
GRANT ALL ON public.cooperativa_carteira TO service_role;
ALTER TABLE public.cooperativa_carteira ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_carteira_le" ON public.cooperativa_carteira
  FOR SELECT TO authenticated
  USING (public.eh_responsavel_cooperativa(cooperativa_id, auth.uid()) OR public.eh_colaborador(auth.uid()));
CREATE TRIGGER trg_coop_carteira_updated BEFORE UPDATE ON public.cooperativa_carteira
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cooperativa_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperativa_id uuid NOT NULL REFERENCES public.cooperativas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('rateio_corrida','repasse','ajuste','estorno')),
  valor numeric NOT NULL,
  descricao text NOT NULL,
  motorista_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
  corrida_urbana_id uuid,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  referencia_externa text,
  environment text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cooperativa_transacoes_rateio_unico
  ON public.cooperativa_transacoes (referencia_externa) WHERE referencia_externa IS NOT NULL;
GRANT SELECT ON public.cooperativa_transacoes TO authenticated;
GRANT ALL ON public.cooperativa_transacoes TO service_role;
ALTER TABLE public.cooperativa_transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_transacoes_le" ON public.cooperativa_transacoes
  FOR SELECT TO authenticated
  USING (public.eh_responsavel_cooperativa(cooperativa_id, auth.uid()) OR public.eh_colaborador(auth.uid()));

CREATE TABLE public.cooperativa_repasses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperativa_id uuid NOT NULL REFERENCES public.cooperativas(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  taxa numeric NOT NULL DEFAULT 0,
  liquido numeric NOT NULL,
  metodo text NOT NULL DEFAULT 'pix',
  modo text NOT NULL DEFAULT 'automatico',
  status text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','processando','pago','falhou','cancelado')),
  provedor text,
  provedor_ref text,
  motivo_falha text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cooperativa_repasses TO authenticated;
GRANT ALL ON public.cooperativa_repasses TO service_role;
ALTER TABLE public.cooperativa_repasses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_repasses_le" ON public.cooperativa_repasses
  FOR SELECT TO authenticated
  USING (public.eh_responsavel_cooperativa(cooperativa_id, auth.uid()) OR public.eh_colaborador(auth.uid()));
CREATE TRIGGER trg_coop_repasses_updated BEFORE UPDATE ON public.cooperativa_repasses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Saldo da cooperativa movimentado automaticamente pelas transações
CREATE OR REPLACE FUNCTION public.aplicar_movimento_cooperativa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cooperativa_carteira (cooperativa_id)
  VALUES (NEW.cooperativa_id)
  ON CONFLICT (cooperativa_id) DO NOTHING;

  IF NEW.tipo = 'repasse' THEN
    UPDATE public.cooperativa_carteira
       SET saldo_disponivel = saldo_disponivel - abs(NEW.valor),
           saldo_repassado = saldo_repassado + abs(NEW.valor)
     WHERE cooperativa_id = NEW.cooperativa_id;
  ELSE
    UPDATE public.cooperativa_carteira
       SET saldo_disponivel = saldo_disponivel + NEW.valor
     WHERE cooperativa_id = NEW.cooperativa_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_coop_movimento AFTER INSERT ON public.cooperativa_transacoes
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimento_cooperativa();

/* ---------------------------------------------------------- corridas urbanas */
CREATE TABLE public.corridas_urbanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passageiro_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorista_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cooperativa_id uuid REFERENCES public.cooperativas(id) ON DELETE SET NULL,
  modo text NOT NULL DEFAULT 'imediato' CHECK (modo IN ('imediato','agendado')),
  municipio text NOT NULL,
  uf text NOT NULL,
  origem_endereco text NOT NULL,
  origem_latitude numeric NOT NULL,
  origem_longitude numeric NOT NULL,
  destino_endereco text NOT NULL,
  destino_latitude numeric NOT NULL,
  destino_longitude numeric NOT NULL,
  distancia_km numeric NOT NULL DEFAULT 0,
  duracao_min numeric NOT NULL DEFAULT 0,
  agendada_para timestamptz,
  bandeirada numeric NOT NULL DEFAULT 0,
  valor_km numeric NOT NULL DEFAULT 0,
  valor_minuto numeric NOT NULL DEFAULT 0,
  fator_pico numeric NOT NULL DEFAULT 1,
  base numeric NOT NULL DEFAULT 0,
  taxa_administrativa numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  parcela_plataforma numeric NOT NULL DEFAULT 0,
  parcela_cooperativa numeric NOT NULL DEFAULT 0,
  forma_pagamento text NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('pix','credito','debito','dinheiro')),
  status text NOT NULL DEFAULT 'ofertada'
    CHECK (status IN ('ofertada','aceita','a_caminho','aguardando','em_viagem','concluida','cancelada','expirada')),
  cancelada_por text CHECK (cancelada_por IN ('passageiro','motorista','plataforma')),
  motivo_cancelamento text,
  taxa_cancelamento numeric NOT NULL DEFAULT 0,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  avaliacao_motorista integer CHECK (avaliacao_motorista BETWEEN 1 AND 5),
  avaliacao_passageiro integer CHECK (avaliacao_passageiro BETWEEN 1 AND 5),
  aceita_em timestamptz,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX corridas_urbanas_oferta_idx ON public.corridas_urbanas (uf, municipio, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.corridas_urbanas TO authenticated;
GRANT ALL ON public.corridas_urbanas TO service_role;
ALTER TABLE public.corridas_urbanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corridas_urbanas_passageiro" ON public.corridas_urbanas
  FOR SELECT TO authenticated USING (auth.uid() = passageiro_id);
CREATE POLICY "corridas_urbanas_passageiro_cria" ON public.corridas_urbanas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = passageiro_id);
CREATE POLICY "corridas_urbanas_passageiro_atualiza" ON public.corridas_urbanas
  FOR UPDATE TO authenticated USING (auth.uid() = passageiro_id) WITH CHECK (auth.uid() = passageiro_id);
CREATE POLICY "corridas_urbanas_motorista" ON public.corridas_urbanas
  FOR SELECT TO authenticated USING (auth.uid() = motorista_id);
CREATE POLICY "corridas_urbanas_motorista_atualiza" ON public.corridas_urbanas
  FOR UPDATE TO authenticated USING (auth.uid() = motorista_id) WITH CHECK (auth.uid() = motorista_id);
CREATE POLICY "corridas_urbanas_ofertas_do_municipio" ON public.corridas_urbanas
  FOR SELECT TO authenticated USING (
    status = 'ofertada' AND EXISTS (
      SELECT 1 FROM public.motoristas_urbanos mu
      WHERE mu.user_id = auth.uid() AND mu.ativo
        AND mu.uf = corridas_urbanas.uf AND mu.municipio = corridas_urbanas.municipio
    )
  );
CREATE POLICY "corridas_urbanas_gestao_le" ON public.corridas_urbanas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE TRIGGER trg_corridas_urbanas_updated BEFORE UPDATE ON public.corridas_urbanas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cooperativa_transacoes
  ADD CONSTRAINT cooperativa_transacoes_corrida_urbana_fkey
  FOREIGN KEY (corrida_urbana_id) REFERENCES public.corridas_urbanas(id) ON DELETE SET NULL;

/* ---------------------------------- lançamentos contábeis do rateio */
ALTER TABLE public.lancamentos_contabeis
  ADD COLUMN IF NOT EXISTS cooperativa_id uuid REFERENCES public.cooperativas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrida_urbana_id uuid REFERENCES public.corridas_urbanas(id) ON DELETE SET NULL;