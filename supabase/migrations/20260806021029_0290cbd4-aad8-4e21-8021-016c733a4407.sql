ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_secundario';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional';

ALTER TABLE public.solicitacoes_admin
  ADD COLUMN IF NOT EXISTS perfil_solicitado public.app_role NOT NULL DEFAULT 'admin';

CREATE OR REPLACE FUNCTION public.aplicar_decisao_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovada' AND COALESCE(OLD.status, '') <> 'aprovada' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, NEW.perfil_solicitado)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NEW.status = 'recusada' AND COALESCE(OLD.status, '') = 'aprovada' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = NEW.perfil_solicitado;
  END IF;
  RETURN NEW;
END;
$function$;