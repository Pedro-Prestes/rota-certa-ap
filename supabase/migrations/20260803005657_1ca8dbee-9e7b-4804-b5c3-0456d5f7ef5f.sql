CREATE TABLE public.verificacoes_biometricas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil TEXT NOT NULL DEFAULT 'passageiro' CHECK (perfil IN ('passageiro','motorista')),
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('aprovada','reprovada','em_analise')),
  imagem_path TEXT,
  imagem_hash TEXT,
  qualidade NUMERIC(5,2) NOT NULL DEFAULT 0,
  prova_vida JSONB NOT NULL DEFAULT '{}'::jsonb,
  pendencias TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  motivo TEXT,
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_biometricas_user ON public.verificacoes_biometricas(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.verificacoes_biometricas TO authenticated;
GRANT ALL ON public.verificacoes_biometricas TO service_role;

ALTER TABLE public.verificacoes_biometricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas biometrias"
  ON public.verificacoes_biometricas FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario cria suas biometrias"
  ON public.verificacoes_biometricas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_verificacoes_biometricas_updated_at
  BEFORE UPDATE ON public.verificacoes_biometricas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.biometria_aprovada(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.verificacoes_biometricas
    WHERE user_id = user_uuid AND status = 'aprovada'
  );
$$;

REVOKE ALL ON FUNCTION public.biometria_aprovada(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.biometria_aprovada(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.biometria_aprovada(UUID) TO service_role;
