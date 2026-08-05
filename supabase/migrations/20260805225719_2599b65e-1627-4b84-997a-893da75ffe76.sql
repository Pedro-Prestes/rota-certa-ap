CREATE TABLE public.pontos_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  data_viagem date NOT NULL,
  passageiro_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passageiro_nome text NOT NULL DEFAULT '',
  telefone text,
  assentos integer NOT NULL DEFAULT 1 CHECK (assentos > 0),
  endereco text NOT NULL,
  referencia text,
  latitude numeric(10,7) NOT NULL,
  longitude numeric(10,7) NOT NULL,
  status text NOT NULL DEFAULT 'proposto' CHECK (status IN ('proposto','aceito','contraproposta','recusado','cancelado')),
  motivo text,
  contra_endereco text,
  contra_latitude numeric(10,7),
  contra_longitude numeric(10,7),
  ordem integer,
  eta_ponto timestamptz,
  saida_motorista timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rota_id, data_viagem, passageiro_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pontos_embarque TO authenticated;
GRANT ALL ON public.pontos_embarque TO service_role;
ALTER TABLE public.pontos_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passageiro gerencia seus pontos"
ON public.pontos_embarque FOR ALL TO authenticated
USING (passageiro_id = auth.uid())
WITH CHECK (passageiro_id = auth.uid());

CREATE POLICY "Motorista da rota gerencia pontos"
ON public.pontos_embarque FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid()));

CREATE POLICY "Admin ve pontos"
ON public.pontos_embarque FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pontos_embarque_updated
BEFORE UPDATE ON public.pontos_embarque
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.planos_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  data_viagem date NOT NULL,
  distancia_busca_km numeric(10,2) NOT NULL DEFAULT 0,
  duracao_busca_min integer NOT NULL DEFAULT 0,
  custo_busca numeric(12,2) NOT NULL DEFAULT 0,
  saida_motorista timestamptz,
  partida_garantida timestamptz,
  sequencia jsonb NOT NULL DEFAULT '[]'::jsonb,
  provedor text NOT NULL DEFAULT 'geometrico',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rota_id, data_viagem)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_embarque TO authenticated;
GRANT ALL ON public.planos_embarque TO service_role;
ALTER TABLE public.planos_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motorista da rota gerencia plano"
ON public.planos_embarque FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid()));

CREATE POLICY "Passageiro com ponto ve plano"
ON public.planos_embarque FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pontos_embarque p
  WHERE p.rota_id = planos_embarque.rota_id
    AND p.data_viagem = planos_embarque.data_viagem
    AND p.passageiro_id = auth.uid()
));

CREATE POLICY "Admin ve planos"
ON public.planos_embarque FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_planos_embarque_updated
BEFORE UPDATE ON public.planos_embarque
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();