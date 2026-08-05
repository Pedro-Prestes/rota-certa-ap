REVOKE EXECUTE ON FUNCTION public.pode_ver_viagem(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.saida_protegida(uuid, date, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pode_ver_viagem(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.saida_protegida(uuid, date, uuid) TO authenticated, service_role;