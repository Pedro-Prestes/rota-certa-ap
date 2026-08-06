-- 1. Novo perfil: frotista
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'frotista';

-- 2. Funções auxiliares de escopo de frota
CREATE OR REPLACE FUNCTION public.frotista_id_do_usuario(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id FROM public.frotistas f WHERE f.user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.eh_frotista_da_rota(_rota_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rotas r
    JOIN public.frotistas f ON f.id = r.frotista_id
    WHERE r.id = _rota_id AND f.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.frotista_id_do_usuario(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.eh_frotista_da_rota(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frotista_id_do_usuario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eh_frotista_da_rota(uuid, uuid) TO authenticated;

-- 3. Trigger: quem cria empresa recebe o perfil frotista
CREATE OR REPLACE FUNCTION public.conceder_perfil_frotista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'frotista'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.conceder_perfil_frotista() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_frotista_perfil ON public.frotistas;
CREATE TRIGGER trg_frotista_perfil
AFTER INSERT ON public.frotistas
FOR EACH ROW EXECUTE FUNCTION public.conceder_perfil_frotista();

-- 4. Visibilidade da frota (somente leitura, escopo da própria empresa)
DROP POLICY IF EXISTS veiculos_frota_select ON public.veiculos;
CREATE POLICY veiculos_frota_select ON public.veiculos
FOR SELECT TO authenticated
USING (frotista_id IS NOT NULL AND frotista_id = public.frotista_id_do_usuario(auth.uid()));

DROP POLICY IF EXISTS rotas_frota_select ON public.rotas;
CREATE POLICY rotas_frota_select ON public.rotas
FOR SELECT TO authenticated
USING (frotista_id IS NOT NULL AND frotista_id = public.frotista_id_do_usuario(auth.uid()));

DROP POLICY IF EXISTS indisp_frota_select ON public.veiculo_indisponibilidades;
CREATE POLICY indisp_frota_select ON public.veiculo_indisponibilidades
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.veiculos v
  WHERE v.id = veiculo_indisponibilidades.veiculo_id
    AND v.frotista_id IS NOT NULL
    AND v.frotista_id = public.frotista_id_do_usuario(auth.uid())
));

DROP POLICY IF EXISTS viagens_frota_select ON public.viagens;
CREATE POLICY viagens_frota_select ON public.viagens
FOR SELECT TO authenticated
USING (public.eh_frotista_da_rota(rota_id, auth.uid()));

DROP POLICY IF EXISTS rota_veiculos_frota_select ON public.rota_veiculos;
CREATE POLICY rota_veiculos_frota_select ON public.rota_veiculos
FOR SELECT TO authenticated
USING (public.eh_frotista_da_rota(rota_id, auth.uid()));
