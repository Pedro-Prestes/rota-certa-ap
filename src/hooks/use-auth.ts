import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { temAcesso, type Perfil } from "@/lib/acessos";

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

export function usePerfis(userId: string | undefined) {
  const [perfis, setPerfis] = useState<Perfil[]>([]);

  useEffect(() => {
    if (!userId) {
      setPerfis([]);
      return;
    }
    let ativo = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (ativo) setPerfis((data ?? []).map((r) => r.role as Perfil));
      });
    return () => {
      ativo = false;
    };
  }, [userId]);

  return perfis;
}

/** Estado consolidado de acesso: sessão + perfis + helpers de autorização. */
export function useAcesso() {
  const { user, session, carregando: carregandoSessao } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregandoPerfis, setCarregandoPerfis] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setPerfis([]);
      setCarregandoPerfis(!!user);
      return;
    }
    let ativo = true;
    setCarregandoPerfis(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!ativo) return;
        setPerfis((data ?? []).map((r) => r.role as Perfil));
        setCarregandoPerfis(false);
      });
    return () => {
      ativo = false;
    };
  }, [user?.id, user]);

  return {
    user,
    session,
    perfis,
    carregando: carregandoSessao || (!!user && carregandoPerfis),
    ehAdmin: perfis.includes("admin"),
    ehMotorista: perfis.includes("motorista"),
    ehPassageiro: perfis.includes("passageiro"),
    ehFrotista: perfis.includes("frotista"),
    pode: (permitidos: Perfil[]) => temAcesso(perfis, permitidos),
  };
}
