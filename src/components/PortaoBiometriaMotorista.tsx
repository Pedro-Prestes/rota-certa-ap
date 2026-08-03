import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanFace, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Portão de acesso do motorista: a biometria facial aprovada é obrigatória para
 * operar. Passageiros não são bloqueados.
 */
export function PortaoBiometriaMotorista({ children }: { children: React.ReactNode }) {
  const { user, carregando } = useAuth();

  const status = useQuery({
    queryKey: ["biometria-motorista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verificacoes_biometricas")
        .select("status")
        .eq("status", "aprovada")
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });

  if (carregando || (user && status.isLoading)) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Conferindo sua biometria…
      </div>
    );
  }

  if (status.data) return <>{children}</>;

  return (
    <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-6">
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <ShieldAlert className="size-5 text-destructive" /> Biometria facial obrigatória
      </p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Para publicar rotas, cadastrar veículos e receber corridas, o motorista precisa concluir a
        verificação facial com prova de vida. Leva menos de um minuto e usa apenas a câmera do seu
        aparelho.
      </p>
      <Link
        to={user ? "/biometria" : "/auth"}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <ScanFace className="size-4" />
        {user ? "Fazer a biometria facial" : "Entrar para verificar"}
      </Link>
    </div>
  );
}
