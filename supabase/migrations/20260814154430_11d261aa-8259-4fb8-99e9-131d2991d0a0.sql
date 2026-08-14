CREATE TABLE public.habilitacoes_motorista (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero text NOT NULL,
  categoria text NOT NULL,
  ear boolean NOT NULL DEFAULT false,
  validade date,
  primeira_habilitacao date,
  status public.status_verificacao NOT NULL DEFAULT 'pendente',
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.habilitacoes_motorista TO authenticated;
GRANT ALL ON public.habilitacoes_motorista TO service_role;

ALTER TABLE public.habilitacoes_motorista ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hab_dono_select" ON public.habilitacoes_motorista
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "hab_dono_insert" ON public.habilitacoes_motorista
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hab_dono_update" ON public.habilitacoes_motorista
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "hab_admin_total" ON public.habilitacoes_motorista
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_habilitacoes_updated BEFORE UPDATE ON public.habilitacoes_motorista
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.motorista_fase_liberada(_user_id uuid, _fase integer)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _fase <= 1 THEN true
    WHEN _fase = 2 THEN (
      EXISTS (
        SELECT 1 FROM public.verificacoes_idoneidade v
        WHERE v.user_id = _user_id AND v.alvo = 'motorista'::public.alvo_verificacao
          AND v.status = 'aprovado'::public.status_verificacao
      )
      AND EXISTS (
        SELECT 1 FROM public.verificacoes_biometricas b
        WHERE b.user_id = _user_id AND b.status = 'aprovada'
      )
    )
    ELSE (
      public.motorista_fase_liberada(_user_id, 2)
      AND EXISTS (
        SELECT 1 FROM public.habilitacoes_motorista h
        WHERE h.user_id = _user_id AND h.status = 'aprovado'::public.status_verificacao
          AND (h.validade IS NULL OR h.validade >= CURRENT_DATE)
      )
    )
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.motorista_fase_liberada(uuid, integer) FROM anon;

CREATE OR REPLACE FUNCTION public.exigir_fases_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.user_id, 'admin'::public.app_role)
     OR NEW.frotista_id IS NOT NULL
     OR public.has_role(NEW.user_id, 'frotista'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NOT public.motorista_fase_liberada(NEW.user_id, 3) THEN
    RAISE EXCEPTION 'Conclua as fases anteriores (idoneidade + biometria facial e habilitação aprovada) antes de cadastrar o veículo.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_veiculos_fases BEFORE INSERT ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.exigir_fases_veiculo();