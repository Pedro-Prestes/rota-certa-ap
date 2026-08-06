import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { provisionarConta } from "@/lib/conta.functions";
import { temAcesso, PERFIS_COLABORADOR, PERFIS_GESTAO, type Perfil } from "@/lib/acessos";

export type { Perfil };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setCarregando(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setCarregando(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, carregando };
}

async function carregarPerfis(userId: string, provisionar: () => Promise<{ perfis: string[] }>) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const perfis = (data ?? []).map((r) => r.role as Perfil);
  if (perfis.length > 0) return perfis;
  // Conta sem papéis (primeiro acesso): provisiona perfil e papéis no servidor.
  try {
    const resultado = await provisionar();
    return resultado.perfis as Perfil[];
  } catch (erro) {
    console.error("[conta] falha ao provisionar perfis", erro);
    return perfis;
  }
}

export function usePerfis(userId: string | undefined) {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const provisionar = useServerFn(provisionarConta);

  useEffect(() => {
    if (!userId) {
      setPerfis([]);
      return;
    }
    let ativo = true;
    carregarPerfis(userId, provisionar).then((lista) => {
      if (ativo) setPerfis(lista);
    });
    return () => {
      ativo = false;
    };
  }, [userId, provisionar]);

  return perfis;
}

/** Estado consolidado de acesso: sessão + perfis + helpers de autorização. */
export function useAcesso() {
  const { user, session, carregando: carregandoSessao } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(true);
  const provisionar = useServerFn(provisionarConta);

  useEffect(() => {
    if (!user?.id) {
      setPerfis([]);
      setCarregandoPerfis(!!user);
      return;
    }
    let ativo = true;
    setCarregandoPerfis(true);
    carregarPerfis(user.id, provisionar).then((lista) => {
      if (!ativo) return;
      setPerfis(lista);
      setCarregandoPerfis(false);
    });
    return () => {
      ativo = false;
    };
  }, [user?.id, user, provisionar]);

  return {
    user,
    session,
    perfis,
    carregando: carregandoSessao || (!!user && carregandoPerfis),
    ehAdmin: perfis.includes("admin"),
    ehMotorista: perfis.includes("motorista"),
    ehPassageiro: perfis.includes("passageiro"),
    ehFrotista: perfis.includes("frotista"),
    ehColaborador: temAcesso(perfis, PERFIS_COLABORADOR),
    ehGestao: temAcesso(perfis, PERFIS_GESTAO),
    pode: (permitidos: Perfil[]) => temAcesso(perfis, permitidos),
  };
}
