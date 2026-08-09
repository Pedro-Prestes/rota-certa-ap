-- coberturas_seguro: owner read-only
DROP POLICY IF EXISTS "Titular gerencia sua cobertura" ON public.coberturas_seguro;
CREATE POLICY "Titular ve sua cobertura"
ON public.coberturas_seguro FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- sinistros: driver may open + read own, not update
DROP POLICY IF EXISTS "Motorista abre e acompanha seus chamados" ON public.sinistros;
CREATE POLICY "Motorista abre seus chamados"
ON public.sinistros FOR INSERT TO authenticated
WITH CHECK (motorista_id = auth.uid());
CREATE POLICY "Motorista acompanha seus chamados"
ON public.sinistros FOR SELECT TO authenticated
USING (motorista_id = auth.uid());

-- verificacoes_idoneidade: owner cannot update status/score/result
DROP POLICY IF EXISTS "verif_dono_total" ON public.verificacoes_idoneidade;
CREATE POLICY "verif_dono_select"
ON public.verificacoes_idoneidade FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "verif_dono_insert"
ON public.verificacoes_idoneidade FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verif_dono_delete"
ON public.verificacoes_idoneidade FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- revoke anon/public EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.promo_vagas_restantes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.aplicar_movimento_carteira() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aplicar_movimento_carteira() FROM anon;