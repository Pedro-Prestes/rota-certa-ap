-- ============ ENUMS ============
CREATE TYPE public.tipo_lancamento AS ENUM (
  'receita_bruta','taxa_plataforma','taxa_gateway','repasse_motorista',
  'estorno','custo_terceiro','ajuste'
);
CREATE TYPE public.status_estorno AS ENUM ('solicitado','processando','concluido','falhou','cancelado');
CREATE TYPE public.status_verificacao AS ENUM ('pendente','em_analise','aprovado','reprovado','expirado');
CREATE TYPE public.alvo_verificacao AS ENUM ('passageiro','motorista','veiculo');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- ============ 1. CONFIGURAÇÃO DA TAXA ADMINISTRATIVA ============
CREATE TABLE public.plataforma_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  taxa_percentual NUMERIC(6,3) NOT NULL DEFAULT 12.000,
  taxa_fixa NUMERIC(10,2) NOT NULL DEFAULT 1.50,
  repasse_motorista_percentual NUMERIC(6,3) NOT NULL DEFAULT 88.000,
  descricao TEXT NOT NULL DEFAULT 'Taxa administrativa destinada à manutenção automatizada da plataforma e à contratação de serviços de terceiros.',
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plataforma_config TO authenticated;
GRANT ALL ON public.plataforma_config TO service_role;
ALTER TABLE public.plataforma_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfg_leitura_autenticada" ON public.plataforma_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfg_admin_escreve" ON public.plataforma_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "cfg_admin_atualiza" ON public.plataforma_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "cfg_admin_remove" ON public.plataforma_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cfg_updated BEFORE UPDATE ON public.plataforma_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plataforma_config (chave, taxa_percentual, taxa_fixa, repasse_motorista_percentual)
VALUES ('vigente', 12.000, 1.50, 88.000);

-- ============ 2. CUSTOS DE TERCEIROS ============
CREATE TABLE public.custos_terceiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'infraestrutura',
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  recorrente BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custos_terceiros TO authenticated;
GRANT ALL ON public.custos_terceiros TO service_role;
ALTER TABLE public.custos_terceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custos_admin_total" ON public.custos_terceiros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_custos_updated BEFORE UPDATE ON public.custos_terceiros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.custos_terceiros (fornecedor, categoria, descricao, valor, competencia, recorrente) VALUES
  ('Provedor de nuvem','infraestrutura','Hospedagem, banco de dados e backups automatizados', 420.00, CURRENT_DATE, true),
  ('Gateway de pagamento','pagamentos','Processamento de Pix, cartões e antifraude', 260.00, CURRENT_DATE, true),
  ('Bureau de idoneidade','conformidade','Consultas de CPF, CNH e CRLV por API', 180.00, CURRENT_DATE, true),
  ('Provedor de SMS','comunicacao','Envio de códigos de verificação', 95.00, CURRENT_DATE, true);

-- ============ 3. ESTORNOS ============
CREATE TABLE public.estornos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pagamento_id UUID NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  integral BOOLEAN NOT NULL DEFAULT false,
  devolve_taxa BOOLEAN NOT NULL DEFAULT false,
  motivo TEXT NOT NULL DEFAULT '',
  status public.status_estorno NOT NULL DEFAULT 'solicitado',
  provedor TEXT,
  provedor_ref TEXT,
  autorizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estornos_pagamento ON public.estornos(pagamento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estornos TO authenticated;
GRANT ALL ON public.estornos TO service_role;
ALTER TABLE public.estornos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estornos_admin_total" ON public.estornos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "estornos_dono_le" ON public.estornos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.id = estornos.pagamento_id AND p.user_id = auth.uid()));
CREATE TRIGGER trg_estornos_updated BEFORE UPDATE ON public.estornos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 4. LIVRO CONTÁBIL ============
CREATE TABLE public.lancamentos_contabeis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.tipo_lancamento NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  competencia DATE NOT NULL DEFAULT CURRENT_DATE,
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE SET NULL,
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  estorno_id UUID REFERENCES public.estornos(id) ON DELETE SET NULL,
  custo_id UUID REFERENCES public.custos_terceiros(id) ON DELETE SET NULL,
  detalhamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lanc_competencia ON public.lancamentos_contabeis(competencia DESC);
CREATE INDEX idx_lanc_corrida ON public.lancamentos_contabeis(corrida_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_contabeis TO authenticated;
GRANT ALL ON public.lancamentos_contabeis TO service_role;
ALTER TABLE public.lancamentos_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lanc_admin_total" ON public.lancamentos_contabeis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.lancamentos_contabeis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5. TRAJETOS ============
CREATE TABLE public.trajetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corrida_id UUID NOT NULL REFERENCES public.corridas(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL DEFAULT 0,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  velocidade_kmh NUMERIC(6,2),
  precisao_m NUMERIC(8,2),
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajetos_corrida ON public.trajetos(corrida_id, sequencia);
GRANT SELECT, INSERT ON public.trajetos TO authenticated;
GRANT ALL ON public.trajetos TO service_role;
ALTER TABLE public.trajetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trajetos_leitura_autenticada" ON public.trajetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "trajetos_dono_grava" ON public.trajetos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.corridas c WHERE c.id = trajetos.corrida_id AND c.user_id = auth.uid()));

-- ============ 6. CADEIA DE BLOCOS ============
CREATE TABLE public.blockchain_blocos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indice BIGSERIAL NOT NULL UNIQUE,
  corrida_id UUID REFERENCES public.corridas(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_anterior TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blocos_corrida ON public.blockchain_blocos(corrida_id, indice);
GRANT SELECT, INSERT ON public.blockchain_blocos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.blockchain_blocos_indice_seq TO authenticated;
GRANT ALL ON public.blockchain_blocos TO service_role;
GRANT ALL ON SEQUENCE public.blockchain_blocos_indice_seq TO service_role;
ALTER TABLE public.blockchain_blocos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocos_leitura_autenticada" ON public.blockchain_blocos FOR SELECT TO authenticated USING (true);
CREATE POLICY "blocos_dono_grava" ON public.blockchain_blocos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR corrida_id IS NULL OR EXISTS (SELECT 1 FROM public.corridas c WHERE c.id = blockchain_blocos.corrida_id AND c.user_id = auth.uid()));

-- ============ 7. VEÍCULOS ============
CREATE TABLE public.veiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa TEXT NOT NULL,
  renavam TEXT,
  chassi TEXT,
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  ano INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  cor TEXT,
  categoria TEXT NOT NULL DEFAULT 'passageiro',
  assentos INTEGER NOT NULL DEFAULT 4,
  volume_bagageiro_l INTEGER NOT NULL DEFAULT 300,
  carga_util_kg INTEGER NOT NULL DEFAULT 400,
  crlv_situacao TEXT,
  crlv_exercicio INTEGER,
  status_verificacao public.status_verificacao NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, placa)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "veiculos_dono_total" ON public.veiculos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "veiculos_admin_total" ON public.veiculos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_veiculos_updated BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 8. VERIFICAÇÕES DE IDONEIDADE ============
CREATE TABLE public.verificacoes_idoneidade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alvo public.alvo_verificacao NOT NULL,
  veiculo_id UUID REFERENCES public.veiculos(id) ON DELETE CASCADE,
  documento TEXT NOT NULL DEFAULT '',
  nome_conferido TEXT,
  provedor TEXT NOT NULL DEFAULT 'interno',
  status public.status_verificacao NOT NULL DEFAULT 'pendente',
  pontuacao INTEGER,
  pendencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  resultado JSONB NOT NULL DEFAULT '{}'::jsonb,
  consultado_em TIMESTAMPTZ,
  expira_em DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_verif_user ON public.verificacoes_idoneidade(user_id, alvo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verificacoes_idoneidade TO authenticated;
GRANT ALL ON public.verificacoes_idoneidade TO service_role;
ALTER TABLE public.verificacoes_idoneidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verif_dono_total" ON public.verificacoes_idoneidade FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verif_admin_total" ON public.verificacoes_idoneidade FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_verif_updated BEFORE UPDATE ON public.verificacoes_idoneidade FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();