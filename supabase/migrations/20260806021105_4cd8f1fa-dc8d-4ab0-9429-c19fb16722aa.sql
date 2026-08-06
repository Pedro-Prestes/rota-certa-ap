CREATE OR REPLACE FUNCTION public.eh_colaborador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secundario'::public.app_role,
                   'gerente'::public.app_role, 'operacional'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.eh_gestao(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_secundario'::public.app_role,
                   'gerente'::public.app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.eh_colaborador(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.eh_gestao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_colaborador(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eh_gestao(uuid) TO authenticated, service_role;

CREATE POLICY "Colaboradores veem rotas" ON public.rotas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem viagens" ON public.viagens
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem pontos de embarque" ON public.pontos_embarque
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem planos de embarque" ON public.planos_embarque
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem veiculos" ON public.veiculos
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem frotistas" ON public.frotistas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem corridas" ON public.corridas
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Colaboradores veem sinistros" ON public.sinistros
  FOR SELECT TO authenticated USING (public.eh_colaborador(auth.uid()));
CREATE POLICY "Admin secundario atende sinistros" ON public.sinistros
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin_secundario'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin_secundario'::public.app_role));

CREATE POLICY "Gestao ve pagamentos" ON public.pagamentos
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE POLICY "Gestao ve estornos" ON public.estornos
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE POLICY "Gestao ve custos de terceiros" ON public.custos_terceiros
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE POLICY "Gestao ve lancamentos contabeis" ON public.lancamentos_contabeis
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));
CREATE POLICY "Gestao ve configuracao da plataforma" ON public.plataforma_config
  FOR SELECT TO authenticated USING (public.eh_gestao(auth.uid()));