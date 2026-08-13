CREATE TABLE public.pre_reservas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  data_viagem date NOT NULL,
  passageiro_id uuid NOT NULL,
  assentos integer NOT NULL DEFAULT 1,
  assentos_bagagem integer NOT NULL DEFAULT 0,
  endereco text NOT NULL,
  referencia text,
  latitude double precision,
  longitude double precision,
  exclusiva boolean NOT NULL DEFAULT false,
  bagagem_kg numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  valor_ofertado numeric(12,2),
  valor_base numeric(12,2),
  taxa_desvio numeric(12,2),
  km_desvio numeric(12,2),
  minutos_desvio integer,
  fator_ocupacao numeric(6,3),
  oferta_enviada_em timestamptz,
  oferta_expira_em timestamptz,
  prioridade integer NOT NULL DEFAULT 0,
  corrida_id uuid REFERENCES public.corridas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pre_reservas_status_valido CHECK (status IN ('pendente','ofertada','confirmada','expirada','cancelada')),
  CONSTRAINT pre_reservas_assentos_validos CHECK (assentos BETWEEN 1 AND 20),
  CONSTRAINT pre_reservas_unica UNIQUE (rota_id, data_viagem, passageiro_id)
);

CREATE INDEX pre_reservas_saida_idx ON public.pre_reservas (rota_id, data_viagem, status);
CREATE INDEX pre_reservas_passageiro_idx ON public.pre_reservas (passageiro_id, data_viagem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_reservas TO authenticated;
GRANT ALL ON public.pre_reservas TO service_role;

ALTER TABLE public.pre_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passageiro cria sua pre-reserva"
ON public.pre_reservas FOR INSERT TO authenticated
WITH CHECK (auth.uid() = passageiro_id);

CREATE POLICY "Passageiro ve suas pre-reservas"
ON public.pre_reservas FOR SELECT TO authenticated
USING (
  auth.uid() = passageiro_id
  OR public.eh_admin_master(auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = pre_reservas.rota_id AND r.user_id = auth.uid())
);

CREATE POLICY "Passageiro atualiza sua pre-reserva"
ON public.pre_reservas FOR UPDATE TO authenticated
USING (auth.uid() = passageiro_id OR public.eh_admin_master(auth.uid()))
WITH CHECK (auth.uid() = passageiro_id OR public.eh_admin_master(auth.uid()));

CREATE POLICY "Passageiro remove sua pre-reserva"
ON public.pre_reservas FOR DELETE TO authenticated
USING (auth.uid() = passageiro_id OR public.eh_admin_master(auth.uid()));

CREATE TRIGGER pre_reservas_updated_at
BEFORE UPDATE ON public.pre_reservas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fechamentos_saida (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  data_viagem date NOT NULL,
  fechada_em timestamptz NOT NULL DEFAULT now(),
  partida_prevista timestamptz,
  assentos_prereservados integer NOT NULL DEFAULT 0,
  assentos_confirmados integer NOT NULL DEFAULT 0,
  capacidade integer NOT NULL DEFAULT 0,
  ocupacao numeric(6,3) NOT NULL DEFAULT 0,
  fator_aplicado numeric(6,3) NOT NULL DEFAULT 1,
  km_desvio_total numeric(12,2) NOT NULL DEFAULT 0,
  minutos_desvio_total integer NOT NULL DEFAULT 0,
  receita_confirmada numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_fila',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fechamentos_status_valido CHECK (status IN ('em_fila','confirmada','cancelada')),
  CONSTRAINT fechamentos_unico UNIQUE (rota_id, data_viagem)
);

GRANT SELECT ON public.fechamentos_saida TO authenticated;
GRANT ALL ON public.fechamentos_saida TO service_role;

ALTER TABLE public.fechamentos_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envolvidos veem o fechamento da saida"
ON public.fechamentos_saida FOR SELECT TO authenticated
USING (
  public.eh_admin_master(auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = fechamentos_saida.rota_id AND r.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.pre_reservas p
    WHERE p.rota_id = fechamentos_saida.rota_id
      AND p.data_viagem = fechamentos_saida.data_viagem
      AND p.passageiro_id = auth.uid()
  )
);

CREATE TRIGGER fechamentos_saida_updated_at
BEFORE UPDATE ON public.fechamentos_saida
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();