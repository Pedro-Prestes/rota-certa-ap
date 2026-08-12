import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Handshake,
  MessageCircle,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DiagnosticoCooperativa } from "@/components/DiagnosticoCooperativa";
import { UFS, normalizarUf, type UnidadeFederativa } from "@/lib/ufs";
import {
  BASE_URL,
  CONTEXTO_REGIAO,
  FAQ_COOPERATIVAS,
  WHATSAPP,
  breadcrumbJsonLd,
  faqJsonLd,
} from "@/lib/cooperativas";

const OG_IMAGE = `${BASE_URL}/og-rotacerta.jpg`;

function ufDaRota(raw: string): UnidadeFederativa {
  const sigla = normalizarUf(raw);
  const encontrada = sigla ? UFS.find((u) => u.sigla === sigla) : undefined;
  if (!encontrada) throw notFound();
  return encontrada;
}

export const Route = createFileRoute("/cooperativas/$uf")({
  loader: ({ params }) => ({ uf: ufDaRota(params.uf) }),
  head: ({ loaderData }) => {
    const uf = (loaderData as { uf: UnidadeFederativa } | undefined)?.uf;
    if (!uf) {
      return {
        meta: [
          { title: "Estado não encontrado | RotaCerta Brasil" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    const url = `${BASE_URL}/cooperativas/${uf.sigla.toLowerCase()}`;
    const titulo = `Cooperativa de táxi no ${uf.nome} (${uf.sigla}) | RotaCerta Brasil`;
    const descricao = `Piloto assistido de 90 dias para cooperativas e associações de taxistas do ${uf.nome}: rotas intermunicipais e interestaduais com hora marcada, reservas antecipadas, Pix e cartão, repasses e prestação de contas em um painel.`;

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
            name: `Programa Cooperativa Pioneira RotaCerta no ${uf.nome}`,
            provider: { "@type": "Organization", name: "RotaCerta Brasil", url: BASE_URL },
            areaServed: { "@type": "State", name: uf.nome },
            audience: {
              "@type": "Audience",
              audienceType: `Cooperativas e associações de taxistas do ${uf.nome}`,
            },
            serviceType: "Gestão de transporte e mobilidade cooperativa",
            url,
          }),
        },
        { type: "application/ld+json", children: JSON.stringify(faqJsonLd()) },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbJsonLd([
              ["Início", "/"],
              ["Cooperativas", "/cooperativas"],
              [uf.nome, `/cooperativas/${uf.sigla.toLowerCase()}`],
            ]),
          ),
        },
      ],
    };
  },
  component: CooperativasUf,
});

const BENEFICIOS = [
  { Icone: Users, titulo: "Mais ocupação", texto: "Reúna a oferta dos associados e transforme horários ociosos em rotas reserváveis." },
  { Icone: CalendarCheck, titulo: "Demanda previsível", texto: "Reservas antecipadas permitem planejar veículo, condutor e horário antes da saída." },
  { Icone: CircleDollarSign, titulo: "Financeiro transparente", texto: "Pix, cartão e espécie com taxas, repasses e histórico detalhados para a entidade." },
  { Icone: BarChart3, titulo: "Gestão em um painel", texto: "Acompanhe frota, motoristas, rotas, reservas e resultados sem planilhas dispersas." },
];

function CooperativasUf() {
  const { uf } = Route.useLoaderData();
  const contexto = CONTEXTO_REGIAO[uf.regiao];
  const mensagem = encodeURIComponent(
    `Olá! Represento uma cooperativa/associação de ${uf.nome} e quero conhecer o piloto de 90 dias do RotaCerta. Entidade: ___ | Cidade: ___ | Frota: ___ veículos.`,
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Handshake className="size-4" /> Cooperativa Pioneira · {uf.sigla}
              </span>
              <h1 className="mt-5 text-4xl font-bold sm:text-5xl">
                Cooperativa de táxi no {uf.nome}: mais corridas para os associados
              </h1>
              <p className="mt-5 max-w-2xl text-base text-primary-foreground/80 sm:text-lg">
                No {uf.nome} a operação enfrenta {contexto}. O RotaCerta organiza rotas com hora marcada,
                reservas antecipadas de assento e bagagem, pagamentos e prestação de contas — mantendo as
                regras e a autonomia da entidade.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <a href="#diagnostico">Solicitar diagnóstico no {uf.sigla} <ArrowRight /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <a href={`https://wa.me/${WHATSAPP}?text=${mensagem}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Falar com o fundador
                  </a>
                </Button>
              </div>
            </div>
            <aside className="border-l-4 border-accent bg-primary-foreground/5 p-6">
              <p className="text-sm font-semibold text-accent">Piloto assistido de 90 dias</p>
              <ul className="mt-5 grid gap-4 text-sm text-primary-foreground/80">
                {[
                  "Sem mensalidade e sem renovação automática",
                  `Implantação com 5 a 10 motoristas do ${uf.sigla}`,
                  "Treinamento da diretoria e dos associados",
                  "Revisão semanal e relatório final de resultados",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> {item}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-bold">O que muda na rotina da entidade no {uf.nome}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map(({ Icone, titulo, texto }) => (
              <article key={titulo} className="border-t-2 border-accent bg-card p-5 shadow-[var(--shadow-card)]">
                <Icone className="size-5 text-accent" />
                <h3 className="mt-4 font-bold">{titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-bold">Como implantamos no {uf.sigla}</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-4">
              {[
                "Diagnóstico da operação atual",
                "Acordo de metas do piloto",
                "Cadastro e treinamento dos associados",
                "Rotas ativas e revisão semanal",
              ].map((item, index) => (
                <li key={item} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="pt-2 text-sm font-semibold">{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <DiagnosticoCooperativa
          ufInicial={uf.sigla}
          origem={`pagina_cooperativas_${uf.sigla.toLowerCase()}`}
          titulo={`Conte como sua cooperativa do ${uf.nome} opera hoje`}
        />

        <section className="mx-auto max-w-3xl px-5 pb-12">
          <h2 className="text-2xl font-bold">Dúvidas da diretoria</h2>
          <Accordion type="single" collapsible className="mt-5">
            {FAQ_COOPERATIVAS.map(([pergunta, resposta]) => (
              <AccordionItem key={pergunta} value={pergunta}>
                <AccordionTrigger>{pergunta}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{resposta}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-5 py-12 text-sm">
            <p>
              <Link to="/cooperativas" className="font-semibold text-primary underline">
                Ver o programa nacional para cooperativas
              </Link>{" "}
              ·{" "}
              <Link
                to="/seja-motorista/$uf"
                params={{ uf: uf.sigla.toLowerCase() }}
                className="font-semibold text-primary underline"
              >
                Sou motorista no {uf.sigla}
              </Link>{" "}
              ·{" "}
              <Link to="/sou-frotista" className="font-semibold text-primary underline">
                Tenho empresa com frota (CNPJ)
              </Link>
            </p>
            <p className="mt-4 text-muted-foreground">Outros estados:</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {UFS.filter((u) => u.sigla !== uf.sigla).map((u) => (
                <li key={u.sigla}>
                  <Link
                    to="/cooperativas/$uf"
                    params={{ uf: u.sigla.toLowerCase() }}
                    className="border border-border bg-card px-2 py-1 font-medium transition-colors hover:border-accent hover:text-accent"
                  >
                    {u.sigla}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
