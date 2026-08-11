import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Car,
  Gift,
  LifeBuoy,
  MapPinned,
  Radio,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { supabase } from "@/integrations/supabase/client";
import { consultarVagasPromo } from "@/utils/promocao.functions";
import { UFS, normalizarUf, type UnidadeFederativa } from "@/lib/ufs";

const BASE_URL = "https://rotacertabrasil.com.br";
const OG_IMAGE = `${BASE_URL}/og-rotacerta.jpg`;
const WHATSAPP = "5596984095871";

/** Contexto regional para o texto não ficar idêntico entre os 27 estados. */
const TEXTO_REGIAO: Record<UnidadeFederativa["regiao"], string> = {
  Norte:
    "distâncias longas, travessias de balsa e trechos de estrada de terra: viagem com hora marcada resolve o que a lotação improvisada não garante",
  Nordeste:
    "muita demanda entre o interior e as capitais, com passageiros que precisam chegar a consultas, faculdades e ao trabalho em horário certo",
  "Centro-Oeste":
    "trechos longos entre cidades do agronegócio, onde a previsibilidade de horário vale mais do que o preço mais baixo",
  Sudeste:
    "grande volume de deslocamento diário entre municípios vizinhos e viagens interestaduais de alta procura",
  Sul: "rotas regionais bem estabelecidas e passageiros exigentes com pontualidade e conforto",
};

function ufDaRota(raw: string): UnidadeFederativa {
  const sigla = normalizarUf(raw);
  const encontrada = sigla ? UFS.find((u) => u.sigla === sigla) : undefined;
  if (!encontrada) throw notFound();
  return encontrada;
}

export const Route = createFileRoute("/motorista_/$uf")({
  loader: ({ params }) => ({ uf: ufDaRota(params.uf) }),
  head: ({ params, loaderData }) => {
    const uf = loaderData?.uf;
    const sigla = (params.uf ?? "").toLowerCase();
    if (!uf) {
      return {
        meta: [
          { title: "Estado não encontrado | RotaCerta Brasil" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `${BASE_URL}/motorista/${uf.sigla.toLowerCase()}`;
    const titulo = `Seja motorista no ${uf.nome} (${uf.sigla}) | RotaCerta Brasil`;
    const descricao = `Cadastre suas rotas intermunicipais e interestaduais no ${uf.nome} e receba passageiros com hora marcada. Carteira digital com repasses, rastreio ao vivo e 10 mensalidades gratuitas para os primeiros motoristas do estado.`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: OG_IMAGE },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: `RotaCerta Brasil para motoristas do ${uf.nome}`,
            serviceType: "Transporte intermunicipal e interestadual com hora marcada",
            provider: {
              "@type": "Organization",
              name: "RotaCerta Brasil",
              url: BASE_URL,
              email: "rotacertabrasil@rotacertabrasil.com.br",
            },
            areaServed: {
              "@type": "State",
              name: uf.nome,
              alternateName: uf.sigla,
              containedInPlace: { "@type": "Country", name: "Brasil" },
            },
            audience: { "@type": "Audience", audienceType: "Motoristas e frotistas" },
            url,
          }),
        },
      ],
      // Sigla mantida para depuração de rotas inválidas em log de servidor.
      ...(sigla ? {} : {}),
    };
  },
  component: RecrutamentoUf,
  notFoundComponent: EstadoNaoEncontrado,
});

const ETAPAS = [
  {
    Icone: BadgeCheck,
    titulo: "Crie sua conta",
    texto: "E-mail, Google ou código por SMS. Leva menos de dois minutos.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Faça a biometria facial",
    texto: "Prova de vida para garantir segurança a você e aos passageiros.",
  },
  {
    Icone: Car,
    titulo: "Cadastre seu veículo",
    texto: "Documentos e assentos disponíveis. O veículo é vinculado às suas rotas.",
  },
  {
    Icone: CalendarClock,
    titulo: "Publique sua rota",
    texto:
      "Ponto A, Ponto B e horários. Ao publicar a primeira rota, a cortesia do estado é liberada automaticamente.",
  },
];

const BENEFICIOS = [
  {
    Icone: Wallet,
    titulo: "Carteira digital com repasses",
    texto:
      "Pix, cartões de todas as bandeiras e espécie. Saldo, extrato e saque para a sua conta bancária.",
  },
  {
    Icone: MapPinned,
    titulo: "Embarque acordado",
    texto:
      "A rota de busca é otimizada por georreferenciamento e o horário de partida programado é inviolável.",
  },
  {
    Icone: Radio,
    titulo: "Rastreio ao vivo",
    texto: "O trajeto é transmitido em tempo real, com registro auditável de ponta a ponta.",
  },
  {
    Icone: LifeBuoy,
    titulo: "Proteção contra pane",
    texto:
      "Veículo substituto para os passageiros e reboque do seu veículo até a oficina que você indicar.",
  },
];

function EstadoNaoEncontrado() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Estado não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Confira a sigla do estado — usamos as 27 unidades federativas do Brasil, como
          <span className="font-semibold"> /motorista/ap</span> ou{" "}
          <span className="font-semibold">/motorista/sp</span>.
        </p>
        <Link
          to="/motorista"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Ir para a área do motorista <ArrowRight className="size-4" />
        </Link>
      </main>
    </div>
  );
}

function RecrutamentoUf() {
  const { uf } = Route.useLoaderData();

  const vagas = useQuery({
    queryKey: ["promo-vagas"],
    staleTime: 1000 * 60 * 5,
    queryFn: () => consultarVagasPromo(),
  });

  const rotasAtivas = useQuery({
    queryKey: ["rotas-ativas-uf", uf.sigla],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rotas")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativa")
        .eq("uf_origem", uf.sigla);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const campanhaAtiva = vagas.data?.ativa ?? false;
  const restantes = campanhaAtiva
    ? (vagas.data?.ufs.find((u) => u.uf === uf.sigla)?.restantes ?? vagas.data?.vagasPorUf ?? 0)
    : 0;
  const totalVagas = vagas.data?.vagasPorUf ?? 10;
  const primeiroDoEstado = (rotasAtivas.data ?? 0) === 0;

  const mensagemWpp = encodeURIComponent(
    `Olá! Quero ser motorista da Rota Certa Brasil no ${uf.nome} (${uf.sigla}) e gostaria de saber como começar.`,
  );

  const outrosEstados = UFS.filter((u) => u.sigla !== uf.sigla);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <BotaoVoltar />

        <section className="mt-6 grid items-start gap-8 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              <MapPinned className="size-3.5" /> {uf.nome} · Região {uf.regiao}
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Seja motorista RotaCerta no {uf.nome}
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Transporte intermunicipal e interestadual com hora marcada. No {uf.nome} temos{" "}
              {TEXTO_REGIAO[uf.regiao]}. Você publica a rota com seus horários, o passageiro reserva
              o assento antes e paga por Pix, cartão ou espécie.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Quero cadastrar minha rota <ArrowRight className="size-4" />
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP}?text=${mensagemWpp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
              >
                Falar com o suporte do {uf.sigla}
              </a>
            </div>
          </div>

          <aside className="rounded-3xl border border-border bg-card p-6">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Gift className="size-4 text-primary" /> Cortesia de lançamento no {uf.sigla}
            </p>
            {vagas.isPending ? (
              <p className="mt-4 text-sm text-muted-foreground">Consultando vagas do estado…</p>
            ) : campanhaAtiva && restantes > 0 ? (
              <>
                <p className="mt-4 font-display text-5xl font-bold text-primary">{restantes}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  de {totalVagas} mensalidades gratuitas ainda disponíveis para motoristas do{" "}
                  {uf.nome}.
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  A vaga é reservada automaticamente quando você publica a primeira rota com origem
                  no {uf.sigla}. São 30 dias do plano Motorista Pro sem custo, sem cobrança
                  automática ao terminar.
                </p>
              </>
            ) : campanhaAtiva ? (
              <>
                <p className="mt-4 font-display text-2xl font-bold">Vagas esgotadas no {uf.sigla}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  As {totalVagas} cortesias deste estado já foram concedidas — sinal de que há
                  motoristas ativos por aqui. Você pode cadastrar sua rota normalmente e assinar o
                  plano quando quiser.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                A campanha de lançamento está encerrada neste momento. O cadastro de rotas segue
                aberto para o {uf.nome}.
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-border/70 p-4">
              {rotasAtivas.isPending ? (
                <p className="text-sm text-muted-foreground">Verificando rotas do estado…</p>
              ) : primeiroDoEstado ? (
                <p className="text-sm">
                  <span className="font-semibold">Seja o primeiro motorista do {uf.sigla}.</span>{" "}
                  Ainda não há rotas publicadas neste estado — quem chega primeiro aparece sozinho
                  na busca dos passageiros.
                </p>
              ) : (
                <p className="text-sm">
                  <span className="font-semibold">
                    {rotasAtivas.data} rota{(rotasAtivas.data ?? 0) > 1 ? "s" : ""} ativa
                    {(rotasAtivas.data ?? 0) > 1 ? "s" : ""} no {uf.sigla}.
                  </span>{" "}
                  Há movimento no estado e demanda de passageiros procurando horários.
                </p>
              )}
            </div>
          </aside>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Como começar no {uf.sigla}
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPAS.map(({ Icone, titulo, texto }, i) => (
              <li key={titulo} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
                  <Icone className="size-4" />
                </span>
                <p className="mt-3 font-display text-sm font-bold text-primary">Etapa {i + 1}</p>
                <h3 className="mt-1 font-semibold">{titulo}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            O que você tem ao rodar com a RotaCerta
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Perguntas de quem dirige no {uf.sigla}
          </h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 p-4">
              <dt className="font-semibold">Quanto custa para operar?</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                O plano Motorista Pro é mensal e pode ser pago por Pix com créditos na carteira. Os
                primeiros motoristas de cada estado começam com um mês sem custo.
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <dt className="font-semibold">Quando recebo pelas viagens?</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                O valor entra na sua carteira digital assim que a viagem é concluída, com repasse
                semanal automático para a conta bancária cadastrada.
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <dt className="font-semibold">Preciso de CNPJ?</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Não. Motorista autônomo opera com CPF. O cadastro por CNPJ é para empresas de
                transporte, na área do frotista.
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 p-4">
              <dt className="font-semibold">Tenho mais de um veículo. E aí?</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                A partir de seis veículos, o caminho é o cadastro de frotista (PJ), com motoristas
                associados e painel corporativo.
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              Começar meu cadastro <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/sou-frotista"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
            >
              Tenho empresa de transporte
            </Link>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">Outros estados</h2>
          <nav className="mt-4 flex flex-wrap gap-2">
            {outrosEstados.map((u) => (
              <Link
                key={u.sigla}
                to="/motorista/$uf"
                params={{ uf: u.sigla.toLowerCase() }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {u.nome}
              </Link>
            ))}
          </nav>
        </section>
      </main>
    </div>
  );
}
