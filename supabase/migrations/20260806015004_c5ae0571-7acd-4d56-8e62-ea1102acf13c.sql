REVOKE ALL ON FUNCTION public.aplicar_decisao_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_decisao_admin() TO service_role;
REVOKE ALL ON FUNCTION public.eh_admin_master(uuid) FROM PUBLIC, anon;