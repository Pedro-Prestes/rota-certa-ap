import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleUserRound, LogOut, Bus, Luggage } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth, usePerfis } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — RotaCerta" },
      {
        name: "description",
        content: "Dados do perfil, tipo de conta (passageiro ou motorista) e acesso rápido às áreas do RotaCerta.",
      },
      { property: "og:title", content: "Minha conta — RotaCerta" },
      { property: "og:description", content: "Painel da conta RotaCerta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Conta,
});

interface Perfil {
  nome_completo: string;
  telefone: string | null;
  municipio: string | null;
  uf: string | null;
}

function Conta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const perfis = usePerfis(user?.id);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nome_completo, telefone, municipio, uf")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data));
  }, [user]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth", replace: true });
  }

  const ehMotorista = perfis.includes("motorista");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CircleUserRound className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{perfil?.nome_completo || "Minha conta"}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={sair}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {perfis.length === 0 ? (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              Carregando perfil…
            </span>
          ) : (
            perfis.map((p) => (
              <span
                key={p}
                className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold capitalize text-accent"
              >
                Perfil: {p}
              </span>
            ))
          )}
        </div>

        <dl className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</dt>
            <dd className="mt-1 font-medium">{perfil?.telefone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Município</dt>
            <dd className="mt-1 font-medium">{perfil?.municipio ? `${perfil.municipio}/${perfil.uf ?? "AP"}` : "—"}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={abrirTour}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold"
        >
          <Compass className="size-4 text-accent" /> Como usar o RotaCerta (tour guiado)
        </button>



        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/passageiro"
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
          >
            <Luggage className="size-6 text-accent" />
            <p className="mt-3 font-bold">Área do passageiro</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Buscar rotas, calcular bagagem e reservar assento.
            </p>
          </Link>
          <Link
            to="/motorista"
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
          >
            <Bus className="size-6 text-accent" />
            <p className="mt-3 font-bold">Área do motorista</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ehMotorista
                ? "Publicar rotas, cadastrar veículo e registrar pane ou folga."
                : "Conheça o painel de rotas — ative o perfil de motorista ao cadastrar um veículo."}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
