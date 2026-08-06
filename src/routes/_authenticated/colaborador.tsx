import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpenCheck,
  Briefcase,
  LifeBuoy,
  Loader2,
  MapPinned,
  Route as RouteIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { GuardaPerfil } from "@/components/GuardaPerfil";
import { useAcesso } from "@/hooks/use-auth";
import {
  DESCRICAO_COLABORADOR,
  PERFIS_COLABORADOR,
  ROTULO_PERFIL,
  type Perfil,
} from "@/lib/acessos";

export const Route = createFileRoute("/_authenticated/colaborador")({
  head: () => ({
    meta: [
      { title: "Área do colaborador — RotaCerta" },
      {
        name: "description",
        content:
          "Painel dos colaboradores aprovados pelo administrador master do RotaCerta: operação, embarques, viagens e ocorrências.",
      },
      { property: "og:title", content: "Área do colaborador — RotaCerta" },
      {
        property: "og:description",
        content: "Operação, embarques, viagens e ocorrências para colaboradores do RotaCerta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ColaboradorProtegido,
});

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Cartao({
  Icone,
  titulo,
  valor,
  nota,
}: {
  Icone: typeof RouteIcon;
  titulo: string;
  valor: string;
  nota: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
        <Icone className="size-4" />
      </span>
      <p className="mt-3 text-sm text-muted-foreground">{titulo}</p>
      <p className="font-display text-2xl font-bold tracking-tight">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function Colaborador() {
  const { perfis, ehGestao } = useAcesso();
  const meus = perfis.filter((p) => PERFIS_COLABORADOR.includes(p) || p === "admin");

  const operacao = useQuery({
    queryKey: ["colaborador-operacao"],
    queryFn: async () => {
      const [rotas, viagens, pontos, sinistros] = await Promise.all([
        supabase.from("rotas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
        supabase
          .from("viagens")
          .select("id", { count: "exact", head: true })
          .eq("status", "em_andamento"),
        supabase
          .from("pontos_embarque")
          .select("id", { count: "exact", head: true })
          .eq("status", "proposto"),
        supabase.from("sinistros").select("id", { count: "exact", head: true }).neq("status", "concluido"),
      ]);
      return {
        rotas: rotas.count ?? 0,
        viagens: viagens.count ?? 0,
        pontos: pontos.count ?? 0,
        sinistros: sinistros.count ?? 0,
      };
    },
  });

  const financeiro = useQuery({
    queryKey: ["colaborador-financeiro"],
    enabled: ehGestao,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_contabeis")
        .select("tipo, valor")
        .order("competencia", { ascending: false })
        .limit(500);
      if (error) throw error;
      const receita = (data ?? [])
        .filter((l) => l.tipo === "receita_bruta")
        .reduce((s, l) => s + Number(l.valor), 0);
      const taxas = (data ?? [])
        .filter((l) => l.tipo === "taxa_plataforma")
        .reduce((s, l) => s + Number(l.valor), 0);
      return { receita, taxas, lancamentos: (data ?? []).length };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Briefcase className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Área do colaborador</h1>
            <p className="text-sm text-muted-foreground">
              Acesso concedido pelo administrador master. Seu perfil:{" "}
              {meus.length ? meus.map((p) => ROTULO_PERFIL[p as Perfil]).join(", ") : "—"}.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {operacao.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando a operação…
            </p>
          ) : (
            <>
              <Cartao
                Icone={RouteIcon}
                titulo="Rotas ativas"
                valor={String(operacao.data?.rotas ?? 0)}
                nota="Disponíveis para reserva"
              />
              <Cartao
                Icone={Activity}
                titulo="Viagens em andamento"
                valor={String(operacao.data?.viagens ?? 0)}
                nota="Com rastreio ao vivo"
              />
              <Cartao
                Icone={MapPinned}
                titulo="Embarques a acordar"
                valor={String(operacao.data?.pontos ?? 0)}
                nota="Pontos propostos por passageiros"
              />
              <Cartao
                Icone={LifeBuoy}
                titulo="Ocorrências abertas"
                valor={String(operacao.data?.sinistros ?? 0)}
                nota="Panes em atendimento"
              />
            </>
          )}
        </section>

        {ehGestao && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <BookOpenCheck className="size-4" /> Gestão financeira
            </h2>
            {financeiro.isLoading ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando lançamentos…
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Receita bruta</p>
                  <p className="font-display text-xl font-bold">
                    {moeda(financeiro.data?.receita ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa da plataforma</p>
                  <p className="font-display text-xl font-bold">
                    {moeda(financeiro.data?.taxas ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lançamentos analisados</p>
                  <p className="font-display text-xl font-bold">
                    {financeiro.data?.lancamentos ?? 0}
                  </p>
                </div>
              </div>
            )}
            <Link
              to="/contabil"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Abrir o painel contábil
            </Link>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">O que cada perfil pode fazer</h2>
          <ul className="mt-3 grid gap-3">
            {(["admin_secundario", "gerente", "operacional"] as const).map((p) => (
              <li key={p} className="rounded-xl border border-border/70 p-4">
                <p className="font-semibold">{ROTULO_PERFIL[p]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{DESCRICAO_COLABORADOR[p]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Os acessos são somente leitura, exceto o atendimento de ocorrências de pane pelo
            administrador secundário. Alterações de perfis e estornos seguem exclusivas do
            administrador master.
          </p>
        </section>
      </main>
    </div>
  );
}

function ColaboradorProtegido() {
  return (
    <GuardaPerfil perfis={PERFIS_COLABORADOR}>
      <Colaborador />
    </GuardaPerfil>
  );
}
