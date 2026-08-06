import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useAcesso } from "@/hooks/use-auth";
import { ROTULO_PERFIL, type Perfil } from "@/lib/acessos";

interface Props {
  perfis: Perfil[];
  children: ReactNode;
}

/**
 * Guarda de página por perfil. A restrição real está nas políticas do banco;
 * aqui evitamos exibir áreas que não pertencem ao perfil do usuário.
 */
export function GuardaPerfil({ perfis, children }: Props) {
  const { carregando, pode, perfis: meus } = useAcesso();

  if (carregando) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-24 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Verificando seu acesso…
        </div>
      </div>
    );
  }

  if (!pode(perfis)) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <ShieldAlert className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Área restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva do perfil{" "}
            <strong>{perfis.map((p) => ROTULO_PERFIL[p]).join(" ou ")}</strong>. Seu acesso atual:{" "}
            {meus.length ? meus.map((p) => ROTULO_PERFIL[p]).join(", ") : "nenhum perfil atribuído"}.
          </p>
          <Link
            to="/conta"
            className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Ir para minha conta
          </Link>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
