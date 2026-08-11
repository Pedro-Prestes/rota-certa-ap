import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  Crown,
  LifeBuoy,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { DESCRICAO_COLABORADOR, ROTULO_PERFIL } from "@/lib/acessos";

export const Route = createFileRoute("/area-administrativa")({
  head: () => ({
    meta: [
      { title: "Área administrativa | Gestão e colaboradores do RotaCerta" },
      {
        name: "description",
        content:
          "Conheça a área administrativa do RotaCerta: administrador master, administrador secundário, gerente e operacional, com contabilidade, estornos e assistência.",
      },
      {
        property: "og:title",
        content: "Área administrativa | Gestão e colaboradores do RotaCerta",
      },
      {
        property: "og:description",
        content:
          "Perfis de gestão, painel contábil, estornos, auditoria em blockchain e atendimento de ocorrências.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rotacertabrasil.com.br/area-administrativa" },
      { property: "og:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://rotacertabrasil.com.br/area-administrativa" }],

  }),
  component: AreaAdministrativa,
});

const MODULOS = [
  {
    Icone: BookOpenCheck,
    titulo: "Contábil e financeiro",
    texto:
      "Receita bruta, taxa da plataforma, taxa de gateway, repasses, custos de terceiros e lançamentos detalhados por competência.",
  },
  {
    Icone: ListChecks,
    titulo: "Pagamentos e estornos",
    texto:
      "Pix, cartões de todas as bandeiras e espécie, com estorno integral ou parcial devolvido à origem pelo administrador master.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Auditoria em blockchain",
    texto:
      "Cadeia de blocos com os eventos da operação e o trajeto percorrido, verificável de ponta a ponta.",
  },
  {
    Icone: LifeBuoy,
    titulo: "Assistência e ocorrências",
    texto:
      "Atendimento de panes: veículo substituto, remanejamento de passageiros e reboque até a oficina indicada.",
  },
  {
    Icone: Users,
    titulo: "Usuários e perfis",
    texto:
      "Concessão e remoção de perfis, idoneidade, biometria facial e situação de cada conta da plataforma.",
  },
  {
    Icone: Briefcase,
    titulo: "Aprovação de colaboradores",
    texto:
      "Solicitações de acesso administrativo aprovadas ou recusadas exclusivamente pelo administrador master.",
  },
];

const PERFIS = ["admin_secundario", "gerente", "operacional"] as const;

function AreaAdministrativa() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <section className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Crown className="size-3.5" /> Acesso concedido pelo administrador master
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Área administrativa do RotaCerta
          </h1>
          <p className="mt-4 text-muted-foreground">
            Governança da operação intermunicipal e interestadual: contabilidade demonstrada, estornos controlados,
            auditoria em blockchain e atendimento de ocorrências. Cada colaborador enxerga apenas o
            que o seu perfil permite.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/solicitar-admin"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Solicitar acesso administrativo <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/colaborador"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
            >
              Sou colaborador — abrir painel
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">Módulos disponíveis</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map(({ Icone, titulo, texto }) => (
              <article key={titulo} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
                  <Icone className="size-4" />
                </span>
                <h3 className="mt-3 font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">Perfis de colaborador</h2>
          <ul className="mt-5 grid gap-3">
            <li className="rounded-2xl border border-border/70 p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Crown className="size-4 text-primary" /> {ROTULO_PERFIL.admin} master
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Acesso total: aprova colaboradores, autoriza estornos e define as taxas da
                plataforma.
              </p>
            </li>
            {PERFIS.map((p) => (
              <li key={p} className="rounded-2xl border border-border/70 p-4">
                <p className="font-semibold">{ROTULO_PERFIL[p]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{DESCRICAO_COLABORADOR[p]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Os acessos são somente leitura, exceto o atendimento de ocorrências de pane pelo
            administrador secundário. Alterações de perfis e estornos seguem exclusivas do
            administrador master.
          </p>
        </section>
      </main>
    </div>
  );
}
