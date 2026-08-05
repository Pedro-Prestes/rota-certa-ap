-- 1. VIAGENS -------------------------------------------------------------
CREATE TABLE public.viagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  data_viagem date NOT NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  motorista_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','em_busca','em_viagem','interrompida','concluida')),
  iniciada_em timestamptz,
  concluida_em timestamptz,
  distancia_percorrida_km numeric(10,2) NOT NULL DEFAULT 0,
  ultima_latitude numeric(10,7),
  ultima_longitude numeric(10,7),
  ultima_velocidade_kmh numeric(6,2),
  ultima_posicao_em timestamptz,
  veiculo_substituto_placa text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rota_id, data_viagem)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viagens TO authenticated;
GRANT ALL ON public.viagens TO service_role;
ALTER TABLE public.viagens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_ver_viagem(_viagem_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.viagens v
    WHERE v.id = _viagem_id
      AND (
        v.motorista_id = _user_id
        OR public.has_role(_user_id, 'admin')
        OR EXISTS (
          SELECT 1 FROM public.pontos_embarque p
          WHERE p.rota_id = v.rota_id
            AND p.data_viagem = v.data_viagem
            AND p.passageiro_id = _user_id
            AND p.status = 'aceito'
        )
      )
  );
$$;

CREATE POLICY "Motorista gerencia suas viagens"
ON public.viagens FOR ALL TO authenticated
USING (motorista_id = auth.uid())
WITH CHECK (motorista_id = auth.uid());

CREATE POLICY "Admin ve e atende viagens"
ON public.viagens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin atualiza viagens"
ON public.viagens FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Passageiro acordado acompanha viagem"
ON public.viagens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pontos_embarque p
  WHERE p.rota_id = viagens.rota_id
    AND p.data_viagem = viagens.data_viagem
    AND p.passageiro_id = auth.uid()
    AND p.status = 'aceito'
));

CREATE TRIGGER trg_viagens_updated BEFORE UPDATE ON public.viagens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. POSICOES (append-only) ---------------------------------------------
CREATE TABLE public.viagem_posicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  sequencia integer NOT NULL,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  velocidade_kmh numeric(6,2),
  precisao_m numeric(8,2),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX viagem_posicoes_viagem_idx ON public.viagem_posicoes (viagem_id, sequencia);

GRANT SELECT, INSERT ON public.viagem_posicoes TO authenticated;
GRANT ALL ON public.viagem_posicoes TO service_role;
ALTER TABLE public.viagem_posicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envolvidos veem o trajeto"
ON public.viagem_posicoes FOR SELECT TO authenticated
USING (public.pode_ver_viagem(viagem_id, auth.uid()));

CREATE POLICY "Motorista registra posicoes"
ON public.viagem_posicoes FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.viagens v
  WHERE v.id = viagem_posicoes.viagem_id AND v.motorista_id = auth.uid()
));

-- 3. OFICINAS -----------------------------------------------------------
CREATE TABLE public.oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  endereco text NOT NULL,
  telefone text,
  preferida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficinas TO authenticated;
GRANT ALL ON public.oficinas TO service_role;
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motorista gerencia suas oficinas"
ON public.oficinas FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin ve oficinas"
ON public.oficinas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_oficinas_updated BEFORE UPDATE ON public.oficinas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. COBERTURAS ---------------------------------------------------------
CREATE TABLE public.coberturas_seguro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modalidade text NOT NULL CHECK (modalidade IN ('mensal','avulsa')),
  rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL,
  data_viagem date,
  price_id text NOT NULL,
  valor numeric(12,2) NOT NULL,
  assentos integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','cancelada')),
  vigencia_inicio timestamptz NOT NULL DEFAULT now(),
  vigencia_fim timestamptz NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.coberturas_seguro TO authenticated;
GRANT ALL ON public.coberturas_seguro TO service_role;
ALTER TABLE public.coberturas_seguro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Titular gerencia sua cobertura"
ON public.coberturas_seguro FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin ve coberturas"
ON public.coberturas_seguro FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_coberturas_updated BEFORE UPDATE ON public.coberturas_seguro
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.saida_protegida(_rota_id uuid, _data_viagem date, _motorista_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coberturas_seguro c
    WHERE c.status = 'ativa'
      AND c.vigencia_fim > now()
      AND (
        (c.modalidade = 'mensal' AND c.user_id = _motorista_id)
        OR (c.modalidade = 'avulsa' AND c.rota_id = _rota_id AND c.data_viagem = _data_viagem)
      )
  );
$$;

-- 5. SINISTROS ----------------------------------------------------------
CREATE TABLE public.sinistros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  motorista_id uuid NOT NULL REFERENCES auth.users(id),
  cobertura_id uuid REFERENCES public.coberturas_seguro(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES public.oficinas(id) ON DELETE SET NULL,
  tipo_pane text NOT NULL,
  descricao text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  passageiros_afetados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','substituto_despachado','passageiros_realocados','reboque_acionado','veiculo_na_oficina','concluido','cancelado')),
  substituto_motorista text,
  substituto_placa text,
  substituto_eta timestamptz,
  despachado_em timestamptz,
  reboque_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sinistros TO authenticated;
GRANT ALL ON public.sinistros TO service_role;
ALTER TABLE public.sinistros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motorista abre e acompanha seus chamados"
ON public.sinistros FOR ALL TO authenticated
USING (motorista_id = auth.uid())
WITH CHECK (motorista_id = auth.uid());

CREATE POLICY "Admin atende chamados"
ON public.sinistros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin atualiza chamados"
ON public.sinistros FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Passageiro acompanha chamado da sua saida"
ON public.sinistros FOR SELECT TO authenticated
USING (public.pode_ver_viagem(viagem_id, auth.uid()));

CREATE TRIGGER trg_sinistros_updated BEFORE UPDATE ON public.sinistros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. REALTIME -----------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.viagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.viagem_posicoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sinistros;