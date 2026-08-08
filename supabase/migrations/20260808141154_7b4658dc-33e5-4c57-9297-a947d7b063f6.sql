-- Validação de UF (27 siglas)
CREATE OR REPLACE FUNCTION public.uf_valida(_uf text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _uf IS NULL OR _uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO');
$$;

CREATE OR REPLACE FUNCTION public.validar_ufs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v jsonb := to_jsonb(NEW);
  k text;
BEGIN
  FOREACH k IN ARRAY TG_ARGV LOOP
    IF NOT public.uf_valida(v ->> k) THEN
      RAISE EXCEPTION 'UF inválida em %: %', k, v ->> k;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

ALTER TABLE public.rotas
  ADD COLUMN IF NOT EXISTS uf_origem text NOT NULL DEFAULT 'AP',
  ADD COLUMN IF NOT EXISTS uf_destino text NOT NULL DEFAULT 'AP';

ALTER TABLE public.driver_routes
  ADD COLUMN IF NOT EXISTS origin_uf text NOT NULL DEFAULT 'AP',
  ADD COLUMN IF NOT EXISTS destination_uf text NOT NULL DEFAULT 'AP';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE public.frotistas ADD COLUMN IF NOT EXISTS uf text;

UPDATE public.profiles SET uf = 'AP' WHERE uf IS NULL AND municipio IS NOT NULL AND municipio <> '';
UPDATE public.frotistas SET uf = 'AP' WHERE uf IS NULL AND municipio IS NOT NULL AND municipio <> '';

DROP TRIGGER IF EXISTS trg_rotas_uf ON public.rotas;
CREATE TRIGGER trg_rotas_uf BEFORE INSERT OR UPDATE ON public.rotas
FOR EACH ROW EXECUTE FUNCTION public.validar_ufs('uf_origem', 'uf_destino');

DROP TRIGGER IF EXISTS trg_driver_routes_uf ON public.driver_routes;
CREATE TRIGGER trg_driver_routes_uf BEFORE INSERT OR UPDATE ON public.driver_routes
FOR EACH ROW EXECUTE FUNCTION public.validar_ufs('origin_uf', 'destination_uf');

DROP TRIGGER IF EXISTS trg_profiles_uf ON public.profiles;
CREATE TRIGGER trg_profiles_uf BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validar_ufs('uf');

DROP TRIGGER IF EXISTS trg_frotistas_uf ON public.frotistas;
CREATE TRIGGER trg_frotistas_uf BEFORE INSERT OR UPDATE ON public.frotistas
FOR EACH ROW EXECUTE FUNCTION public.validar_ufs('uf');

REVOKE EXECUTE ON FUNCTION public.uf_valida(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_ufs() FROM anon, authenticated;