CREATE TABLE IF NOT EXISTS public.rota_descontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas(id) ON DELETE CASCADE,
  percentual numeric(5,2) NOT NULL CHECK (percentual > 0 AND percentual <= 25),
  trecho text NOT NULL DEFAULT 'ambos' CHECK (trecho IN ('ida','volta','ambos')),
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rota_descontos_rota ON public.rota_descontos(rota_id, ativo);

GRANT SELECT ON public.rota_descontos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_descontos TO authenticated;
GRANT ALL ON public.rota_descontos TO service_role;

ALTER TABLE public.rota_descontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Descontos ativos de rotas ativas sao publicos"
ON public.rota_descontos FOR SELECT
USING (
  ativo
  AND inicio <= now()
  AND (fim IS NULL OR fim > now())
  AND EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.status = 'ativa')
);

CREATE POLICY "Dono da rota ve seus descontos"
ON public.rota_descontos FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR public.eh_admin_master(auth.uid())
);

CREATE POLICY "Dono da rota cria desconto"
ON public.rota_descontos FOR INSERT TO authenticated
WITH CHECK (
  criado_por = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
    OR public.eh_frotista_da_rota(rota_id, auth.uid())
    OR public.eh_admin_master(auth.uid())
  )
);

CREATE POLICY "Dono da rota altera desconto"
ON public.rota_descontos FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR public.eh_admin_master(auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR public.eh_admin_master(auth.uid())
);

CREATE POLICY "Dono da rota remove desconto"
ON public.rota_descontos FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.rotas r WHERE r.id = rota_id AND r.user_id = auth.uid())
  OR public.eh_frotista_da_rota(rota_id, auth.uid())
  OR public.eh_admin_master(auth.uid())
);

CREATE TRIGGER trg_rota_descontos_updated
BEFORE UPDATE ON public.rota_descontos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pre_reservas
  ADD COLUMN IF NOT EXISTS trecho text NOT NULL DEFAULT 'ida',
  ADD COLUMN IF NOT EXISTS reserva_par_id uuid,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.corridas
  ADD COLUMN IF NOT EXISTS trecho text NOT NULL DEFAULT 'ida',
  ADD COLUMN IF NOT EXISTS reserva_par_id uuid,
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric(5,2) NOT NULL DEFAULT 0;