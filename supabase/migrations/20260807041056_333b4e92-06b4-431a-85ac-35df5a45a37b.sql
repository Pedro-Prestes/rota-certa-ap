DROP POLICY IF EXISTS "Frotista da rota gerencia plano" ON public.planos_embarque;
CREATE POLICY "Frotista da rota gerencia plano"
ON public.planos_embarque FOR ALL TO authenticated
USING (public.eh_frotista_da_rota(rota_id, auth.uid()) OR public.eh_gestao(auth.uid()))
WITH CHECK (public.eh_frotista_da_rota(rota_id, auth.uid()) OR public.eh_gestao(auth.uid()));

DROP POLICY IF EXISTS "Motorista da viagem gerencia plano" ON public.planos_embarque;
CREATE POLICY "Motorista da viagem gerencia plano"
ON public.planos_embarque FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.viagens v
  WHERE v.rota_id = planos_embarque.rota_id
    AND v.data_viagem = planos_embarque.data_viagem
    AND v.motorista_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.viagens v
  WHERE v.rota_id = planos_embarque.rota_id
    AND v.data_viagem = planos_embarque.data_viagem
    AND v.motorista_id = auth.uid()
));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_embarque TO authenticated;
GRANT ALL ON public.planos_embarque TO service_role;