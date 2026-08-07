CREATE TABLE public.pagamentos_pix (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provedor text NOT NULL DEFAULT 'mercadopago',
  provedor_payment_id text,
  price_id text NOT NULL,
  finalidade text NOT NULL DEFAULT 'creditos',
  descricao text NOT NULL,
  valor_base numeric(12,2) NOT NULL,
  taxa_percentual numeric(6,3) NOT NULL DEFAULT 0,
  taxa_fixa numeric(12,2) NOT NULL DEFAULT 0,
  taxa_admin numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL,
  creditos numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expira_em timestamptz,
  creditado_em timestamptz,
  environment text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX pagamentos_pix_provedor_payment_id_key
  ON public.pagamentos_pix (provedor, provedor_payment_id)
  WHERE provedor_payment_id IS NOT NULL;
CREATE INDEX pagamentos_pix_user_idx ON public.pagamentos_pix (user_id, created_at DESC);

GRANT SELECT ON public.pagamentos_pix TO authenticated;
GRANT ALL ON public.pagamentos_pix TO service_role;
ALTER TABLE public.pagamentos_pix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seus pagamentos pix"
  ON public.pagamentos_pix FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.eh_gestao(auth.uid()));

CREATE TRIGGER trg_pagamentos_pix_updated
  BEFORE UPDATE ON public.pagamentos_pix
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.webhook_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provedor text NOT NULL,
  evento_id text NOT NULL,
  tipo text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provedor, evento_id)
);

GRANT ALL ON public.webhook_eventos TO service_role;
ALTER TABLE public.webhook_eventos ENABLE ROW LEVEL SECURITY;