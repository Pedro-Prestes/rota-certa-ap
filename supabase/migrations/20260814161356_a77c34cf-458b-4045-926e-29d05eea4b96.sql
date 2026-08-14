ALTER TABLE public.pj_conformidade
  ADD COLUMN IF NOT EXISTS decidido_por uuid,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text;

-- Nenhum documento pode ficar aprovado sem decisão do administrador master.
UPDATE public.pj_conformidade
   SET status = 'em_analise'::public.status_verificacao
 WHERE status = 'aprovado'::public.status_verificacao
   AND decidido_por IS NULL;

-- A empresa envia e acompanha; a decisão é exclusiva do master.
DROP POLICY IF EXISTS "master decide conformidade pj" ON public.pj_conformidade;
CREATE POLICY "master decide conformidade pj"
ON public.pj_conformidade
FOR ALL
TO authenticated
USING (public.eh_admin_master(auth.uid()))
WITH CHECK (public.eh_admin_master(auth.uid()));
