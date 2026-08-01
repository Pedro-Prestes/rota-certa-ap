import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = "passageiro" | "motorista" | "admin";

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
