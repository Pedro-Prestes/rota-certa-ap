CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar NOT NULL,
  municipio text,
  uf text,
  geom extensions.geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.neighborhoods TO anon;
GRANT SELECT ON public.neighborhoods TO authenticated;
GRANT ALL ON public.neighborhoods TO service_role;

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bairros sao publicos para leitura"
  ON public.neighborhoods FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Gestao pode manter bairros"
  ON public.neighborhoods FOR ALL
  TO authenticated
  USING (public.eh_gestao(auth.uid()))
  WITH CHECK (public.eh_gestao(auth.uid()));

CREATE INDEX IF NOT EXISTS neighborhoods_geom_idx ON public.neighborhoods USING GIST (geom);

CREATE TRIGGER trg_neighborhoods_updated
  BEFORE UPDATE ON public.neighborhoods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.calculate_default_trunk_route(
  city_a_geom extensions.geometry,
  city_b_geom extensions.geometry
)
RETURNS TABLE (
  origin_neighborhood varchar,
  destination_neighborhood varchar,
  origin_border_point extensions.geometry,
  destination_border_point extensions.geometry,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH nearest_borders AS (
    SELECT
      ST_ClosestPoint(city_a_geom, ST_Centroid(city_b_geom)) AS pt_a,
      ST_ClosestPoint(city_b_geom, ST_Centroid(city_a_geom)) AS pt_b
  )
  SELECT
    n_a.name,
    n_b.name,
    nb.pt_a,
    nb.pt_b,
    ROUND((ST_DistanceSphere(nb.pt_a, nb.pt_b) / 1000)::numeric, 2)
  FROM nearest_borders nb
  LEFT JOIN public.neighborhoods n_a ON ST_Contains(n_a.geom, nb.pt_a)
  LEFT JOIN public.neighborhoods n_b ON ST_Contains(n_b.geom, nb.pt_b);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_default_trunk_route(extensions.geometry, extensions.geometry) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_default_trunk_route(extensions.geometry, extensions.geometry) TO authenticated, service_role;