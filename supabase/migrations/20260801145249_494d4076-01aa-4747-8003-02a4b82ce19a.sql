CREATE TABLE public.codigos_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  codigo_hash text NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  usado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.codigos_sms TO service_role;

ALTER TABLE public.codigos_sms ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_codigos_sms_telefone ON public.codigos_sms (telefone, created_at DESC);
CREATE INDEX idx_profiles_telefone ON public.profiles (telefone);