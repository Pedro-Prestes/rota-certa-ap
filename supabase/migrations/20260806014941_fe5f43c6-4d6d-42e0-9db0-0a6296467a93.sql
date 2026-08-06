CREATE OR REPLACE FUNCTION public.eh_admin_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.admins_master m ON lower(m.email) = lower(u.email)
    WHERE u.id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.eh_admin_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_admin_master(uuid) TO authenticated, service_role;

CREATE TABLE public.solicitacoes_admin (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  decidido_por uuid REFERENCES auth.users(id),
  decidido_em timestamp with time zone,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX solicitacoes_admin_pendente_unica
  ON public.solicitacoes_admin (user_id) WHERE status = 'pendente';

GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_admin TO authenticated;
GRANT ALL ON public.solicitacoes_admin TO service_role;

ALTER TABLE public.solicitacoes_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios criam a propria solicitacao"
ON public.solicitacoes_admin FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pendente');

CREATE POLICY "Usuarios veem a propria solicitacao"
ON public.solicitacoes_admin FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.eh_admin_master(auth.uid()));

CREATE POLICY "Master decide solicitacoes"
ON public.solicitacoes_admin FOR UPDATE TO authenticated
USING (public.eh_admin_master(auth.uid()))
WITH CHECK (public.eh_admin_master(auth.uid()));

CREATE TRIGGER trg_solicitacoes_admin_updated
BEFORE UPDATE ON public.solicitacoes_admin
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.aplicar_decisao_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovada' AND COALESCE(OLD.status, '') <> 'aprovada' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NEW.status = 'recusada' AND COALESCE(OLD.status, '') = 'aprovada' THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'admin'::public.app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_solicitacoes_admin_decisao
AFTER UPDATE OF status ON public.solicitacoes_admin
FOR EACH ROW EXECUTE FUNCTION public.aplicar_decisao_admin();