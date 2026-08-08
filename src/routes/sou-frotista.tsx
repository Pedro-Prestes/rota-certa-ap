import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  LifeBuoy,
  MapPinned,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { MIN_VEICULOS_FROTISTA } from "@/lib/frotista";

export const Route = createFileRoute("/sou-frotista")({
  head: () => ({
    meta: [
      { title: "Sou frotista | Frota corporativa no RotaCerta" },
      {
        name: "description",
        content:
          "Empresas de transporte de todo o Brasil: cadastre o CNPJ, associe motoristas, vincule veículos às rotas e opere com hora marcada no RotaCerta.",
      },
      { property: "og:title", content: "Sou frotista | Frota corporativa no RotaCerta" },
      {
        property: "og:description",
        content:
          "Cadastro por CNPJ, frota mínima de 6 veículos, motoristas associados e rotas intermunicipais consolidadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SouFrotista,
});

const BENEFICIOS = [
  {
    Icone: Truck,
    titulo: "Frota vinculada às rotas",
    texto:
      "Cada veículo é associado às rotas que atende, com situação operacional em tempo real: ativo, em manutenção ou inativo.",
  },
  {
    Icone: Users,
    titulo: "Motoristas associados",
    texto:
      "Cadastre os condutores da empresa, acompanhe a biometria facial aprovada e a idoneidade de cada um.",
  },
  {
    Icone: MapPinned,
    titulo: "Embarque acordado",
    texto:
      "A rota de busca é otimizada por georreferenciamento e o horário de partida programado permanece inviolável.",
  },
  {
    Icone: Wallet,
    titulo: "Financeiro transparente",
    texto:
      "Pix, cartões de todas as bandeiras e espécie, com taxa administrativa detalhada e repasses demonstrados.",
  },
  {
    Icone: LifeBuoy,
    titulo: "Proteção contra pane",
    texto:
      "Veículo substituto para os passageiros e reboque do veículo até a oficina indicada pelo condutor.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Auditoria em blockchain",
    texto:
      "Todo trajeto percorrido fica registrado em cadeia de blocos, verificável por todos os envolvidos.",
  },
];

const PASSOS = [
  {
    titulo: "Crie a conta corporativa",
    texto: "Escolha o perfil Frotista no cadastro por e-mail, Google ou código via SMS.",
  },
  {
    titulo: "Conclua a biometria facial",
    texto: "A prova de vida do responsável libera o painel corporativo da empresa.",
  },
  {
    titulo: "Informe o CNPJ e os dados da empresa",
    texto: "Razão social, responsável, município de operação e contatos oficiais.",
  },
  {
    titulo: `Cadastre no mínimo ${MIN_VEICULOS_FROTISTA} veículos`,
    texto: "A operação da pessoa jurídica é liberada ao atingir a quota mínima de frota.",
  },
];

function SouFrotista() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Building2 className="size-3.5" /> Pessoa jurídica · CNPJ
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Sua empresa operando com hora marcada
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              A área do frotista reúne frota, motoristas, rotas e financeiro da sua transportadora
              em um só painel. Transporte intermunicipal com hora marcada, embarque acordado com o
              passageiro e prestação de contas auditável.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Cadastrar minha empresa <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/frotista"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
              >
                Já tenho conta — abrir painel
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Requisitos de ativação</p>
            <ul className="mt-4 grid gap-3 text-sm">
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-4 text-success" />
                CNPJ válido com razão social e responsável identificados
              </li>
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-4 text-success" />
                Biometria facial aprovada do responsável pela empresa
              </li>
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-4 text-success" />
                Mínimo de {MIN_VEICULOS_FROTISTA} veículos cadastrados e documentados
              </li>
              <li className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 size-4 text-success" />
                Idoneidade dos motoristas e regularidade dos veículos verificadas
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            O que a empresa ganha na plataforma
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map(({ Icone, titulo, texto }) => (
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
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <ClipboardCheck className="size-5" /> Como começar
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="rounded-2xl border border-border/70 p-4">
                <span className="font-display text-sm font-bold text-primary">
                  Etapa {i + 1}
                </span>
                <p className="mt-1 font-semibold">{p.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Começar o cadastro corporativo <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
