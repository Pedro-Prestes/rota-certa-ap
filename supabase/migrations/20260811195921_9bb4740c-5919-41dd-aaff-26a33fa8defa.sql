-- Controle total do administrador (master) sobre rotas e frota
DROP POLICY IF EXISTS "rotas_admin_select" ON public.rotas;
CREATE POLICY "rotas_admin_total" ON public.rotas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "rota_veiculos_admin_select" ON public.rota_veiculos;
CREATE POLICY "rota_veiculos_admin_total" ON public.rota_veiculos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "frotista_admin_select" ON public.frotistas;
CREATE POLICY "frotista_admin_total" ON public.frotistas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "frotista_mot_admin_select" ON public.frotista_motoristas;
CREATE POLICY "frotista_mot_admin_total" ON public.frotista_motoristas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "veiculo_indisp_admin_total" ON public.veiculo_indisponibilidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));