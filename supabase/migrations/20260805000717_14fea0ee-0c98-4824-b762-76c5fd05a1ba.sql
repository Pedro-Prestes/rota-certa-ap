-- 1. FROTISTAS (pessoa jurídica)
CREATE TABLE public.frotistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  cnpj text NOT NULL UNIQUE,
  razao_social text NOT NULL,
  nome_fantasia text,
  responsavel_nome text NOT NULL,
  email_contato text,
  telefone text,
  municipio text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frotistas TO authenticated;
GRANT ALL ON public.frotistas TO service_role;
ALTER TABLE public.frotistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frotista_owner_all" ON public.frotistas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "frotista_admin_select" ON public.frotistas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_frotistas_updated BEFORE UPDATE ON public.frotistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. MOTORISTAS ASSOCIADOS À PJ
CREATE TABLE public.frotista_motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  frotista_id uuid NOT NULL REFERENCES public.frotistas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cpf text NOT NULL,
  cnh text,
  telefone text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frotista_motoristas TO authenticated;
GRANT ALL ON public.frotista_motoristas TO service_role;
ALTER TABLE public.frotista_motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frotista_mot_owner_all" ON public.frotista_motoristas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.frotistas f WHERE f.id = frotista_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.frotistas f WHERE f.id = frotista_id AND f.user_id = auth.uid()));
CREATE POLICY "frotista_mot_admin_select" ON public.frotista_motoristas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_frotista_mot_updated BEFORE UPDATE ON public.frotista_motoristas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. VEÍCULOS: situação operacional e vínculo com frotista
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS status_operacional text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS frotista_id uuid REFERENCES public.frotistas(id) ON DELETE SET NULL;

-- 4. ROTAS
CREATE TABLE public.rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frotista_id uuid REFERENCES public.frotistas(id) ON DELETE SET NULL,
  origem text NOT NULL,
  destino text NOT NULL,
  saida_ida time,
  chegada_ida time,
  saida_retorno time,
  chegada_retorno time,
  distancia_km numeric(10,2) NOT NULL DEFAULT 0,
  assentos integer NOT NULL DEFAULT 4,
  travessias integer NOT NULL DEFAULT 0,
  dificuldade_via numeric(4,2) NOT NULL DEFAULT 0.5,
  preco_assento numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotas TO authenticated;
GRANT ALL ON public.rotas TO service_role;
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rotas_owner_all" ON public.rotas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rotas_admin_select" ON public.rotas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_rotas_updated BEFORE UPDATE ON public.rotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. VÍNCULO ROTA <-> VEÍCULO
CREATE TABLE public.rota_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rota_id, veiculo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_veiculos TO authenticated;
GRANT ALL ON public.rota_veiculos TO service_role;
ALTER TABLE public.rota_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rota_veiculos_owner_all" ON public.rota_veiculos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.user_id = auth.uid())
  );
CREATE POLICY "rota_veiculos_admin_select" ON public.rota_veiculos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. INDISPONIBILIDADE / MANUTENÇÃO
CREATE TABLE public.veiculo_indisponibilidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rota_id uuid REFERENCES public.rotas(id) ON DELETE SET NULL,
  motivo text NOT NULL,
  mensagem text,
  inicio date NOT NULL DEFAULT current_date,
  retorno_previsto date,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_indisponibilidades TO authenticated;
GRANT ALL ON public.veiculo_indisponibilidades TO service_role;
ALTER TABLE public.veiculo_indisponibilidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "indisp_owner_all" ON public.veiculo_indisponibilidades FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "indisp_admin_select" ON public.veiculo_indisponibilidades FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_indisp_updated BEFORE UPDATE ON public.veiculo_indisponibilidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. QUOTA MÍNIMA DE VEÍCULOS DO FROTISTA (6)
CREATE OR REPLACE FUNCTION public.frotista_liberado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.frotistas f
    WHERE f.user_id = _user_id
      AND (SELECT count(*) FROM public.veiculos v WHERE v.frotista_id = f.id) >= 6
  );
$$;