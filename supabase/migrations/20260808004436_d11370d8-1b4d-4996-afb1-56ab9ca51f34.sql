CREATE POLICY "rotas_frota_manage" ON public.rotas FOR ALL TO authenticated
USING (frotista_id IS NOT NULL AND frotista_id = public.frotista_id_do_usuario(auth.uid()))
WITH CHECK (frotista_id IS NOT NULL AND frotista_id = public.frotista_id_do_usuario(auth.uid()));

CREATE POLICY "rota_veiculos_frota_manage" ON public.rota_veiculos FOR ALL TO authenticated
USING (public.eh_frotista_da_rota(rota_id, auth.uid()))
WITH CHECK (public.eh_frotista_da_rota(rota_id, auth.uid()));

ALTER TABLE public.rota_veiculos DROP CONSTRAINT rota_veiculos_rota_id_fkey,
  ADD CONSTRAINT rota_veiculos_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id) ON DELETE CASCADE;

ALTER TABLE public.planos_embarque DROP CONSTRAINT planos_embarque_rota_id_fkey,
  ADD CONSTRAINT planos_embarque_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id) ON DELETE CASCADE;

ALTER TABLE public.pontos_embarque DROP CONSTRAINT pontos_embarque_rota_id_fkey,
  ADD CONSTRAINT pontos_embarque_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id) ON DELETE CASCADE;

ALTER TABLE public.veiculo_indisponibilidades DROP CONSTRAINT veiculo_indisponibilidades_rota_id_fkey,
  ADD CONSTRAINT veiculo_indisponibilidades_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id) ON DELETE SET NULL;

ALTER TABLE public.coberturas_seguro DROP CONSTRAINT coberturas_seguro_rota_id_fkey,
  ADD CONSTRAINT coberturas_seguro_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id) ON DELETE SET NULL;