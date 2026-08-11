CREATE TABLE public.parcerias_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL CHECK (char_length(trim(entidade)) BETWEEN 3 AND 160),
  cnpj text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  responsavel text NOT NULL CHECK (char_length(trim(responsavel)) BETWEEN 3 AND 120),
  cargo text NOT NULL CHECK (char_length(trim(cargo)) BETWEEN 2 AND 80),
  telefone text NOT NULL CHECK (char_length(trim(telefone)) BETWEEN 10 AND 20),
  email text NOT NULL CHECK (char_length(trim(email)) BETWEEN 5 AND 160),
  municipio text NOT NULL CHECK (char_length(trim(municipio)) BETWEEN 2 AND 120),
  uf text NOT NULL CHECK (public.uf_valida(uf)),
  segmento text NOT NULL DEFAULT 'cooperativa_taxi' CHECK (segmento IN ('cooperativa_taxi', 'associacao_taxi', 'transporte_passageiros', 'fretes_encomendas', 'outro')),
  associados integer NOT NULL CHECK (associados BETWEEN 1 AND 1000000),
  veiculos integer NOT NULL CHECK (veiculos BETWEEN 1 AND 1000000),
  rotas_atuais integer NOT NULL DEFAULT 0 CHECK (rotas_atuais BETWEEN 0 AND 1000000),
  dificuldade text NOT NULL CHECK (char_length(trim(dificuldade)) BETWEEN 10 AND 1500),
  interesse_piloto boolean NOT NULL DEFAULT true,
  consentimento_contato boolean NOT NULL CHECK (consentimento_contato = true),
  origem text NOT NULL DEFAULT 'pagina_cooperativas' CHECK (char_length(origem) BETWEEN 3 AND 120),
  etapa text NOT NULL DEFAULT 'novo' CHECK (etapa IN ('novo', 'qualificado', 'reuniao', 'proposta', 'piloto', 'contratado', 'perdido')),
  proxima_acao_em timestamptz,
  motivo_perda text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perda_exige_motivo CHECK (etapa <> 'perdido' OR char_length(trim(coalesce(motivo_perda, ''))) >= 5)
);
GRANT INSERT ON public.parcerias_leads TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.parcerias_leads TO authenticated;
GRANT ALL ON public.parcerias_leads TO service_role;
ALTER TABLE public.parcerias_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitantes enviam interesse institucional"
ON public.parcerias_leads FOR INSERT TO anon, authenticated
WITH CHECK (
  etapa = 'novo'
  AND proxima_acao_em IS NULL
  AND motivo_perda IS NULL
  AND observacoes IS NULL
  AND consentimento_contato = true
);
CREATE POLICY "Master administra parcerias"
ON public.parcerias_leads FOR ALL TO authenticated
USING (public.eh_admin_master(auth.uid()))
WITH CHECK (public.eh_admin_master(auth.uid()));
CREATE TRIGGER atualizar_parcerias_leads
BEFORE UPDATE ON public.parcerias_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX parcerias_leads_etapa_idx ON public.parcerias_leads (etapa, created_at DESC);
CREATE INDEX parcerias_leads_uf_idx ON public.parcerias_leads (uf, created_at DESC);
CREATE INDEX parcerias_leads_proxima_acao_idx ON public.parcerias_leads (proxima_acao_em) WHERE proxima_acao_em IS NOT NULL;

CREATE TABLE public.parcerias_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.parcerias_leads(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL CHECK (tipo IN ('ligacao', 'whatsapp', 'email', 'reuniao', 'proposta', 'anotacao')),
  resumo text NOT NULL CHECK (char_length(trim(resumo)) BETWEEN 3 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcerias_interacoes TO authenticated;
GRANT ALL ON public.parcerias_interacoes TO service_role;
ALTER TABLE public.parcerias_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master administra historico de parcerias"
ON public.parcerias_interacoes FOR ALL TO authenticated
USING (public.eh_admin_master(auth.uid()))
WITH CHECK (public.eh_admin_master(auth.uid()) AND autor_id = auth.uid());
CREATE INDEX parcerias_interacoes_lead_idx ON public.parcerias_interacoes (lead_id, created_at DESC);