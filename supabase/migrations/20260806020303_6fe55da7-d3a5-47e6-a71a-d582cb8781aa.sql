CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _perfil text;
BEGIN
  INSERT INTO public.profiles (id, nome_completo, telefone, municipio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', ''),
    NEW.raw_user_meta_data ->> 'telefone',
    NEW.raw_user_meta_data ->> 'municipio'
  )
  ON CONFLICT (id) DO NOTHING;

  _perfil := COALESCE(NEW.raw_user_meta_data ->> 'perfil', 'passageiro');

  IF _perfil = 'motorista' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'motorista'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _perfil = 'frotista' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'frotista'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'motorista'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passageiro'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM public.admins_master m WHERE lower(m.email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;