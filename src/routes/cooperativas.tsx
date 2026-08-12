import { createFileRoute, Link } from "@tanstack/react-router";
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
import { UFS } from "@/lib/ufs";
import { BASE_URL, FAQ_COOPERATIVAS, WHATSAPP, breadcrumbJsonLd, faqJsonLd } from "@/lib/cooperativas";
import heroImg from "@/assets/hero-rota.jpg";

export const Route = createFileRoute("/cooperativas")({
  head: () => ({
    meta: [
      { title: "RotaCerta para cooperativas de táxi" },
      { name: "description", content: "Piloto assistido de 90 dias para cooperativas e associações de taxistas organizarem frota, rotas, reservas, pagamentos e prestação de contas." },
      { property: "og:title", content: "Programa Cooperativa Pioneira RotaCerta" },
      { property: "og:description", content: "Mais ocupação, demanda previsível e gestão transparente. Solicite um diagnóstico para sua cooperativa." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${BASE_URL}/cooperativas` },
      { property: "og:image", content: `${BASE_URL}/og-rotacerta.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${BASE_URL}/og-rotacerta.jpg` },
    ],
    links: [{ rel: "canonical", href: `${BASE_URL}/cooperativas` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Programa Cooperativa Pioneira RotaCerta",
          provider: { "@type": "Organization", name: "RotaCerta Brasil", url: BASE_URL },
          areaServed: { "@type": "Country", name: "Brasil" },
          audience: { "@type": "Audience", audienceType: "Cooperativas e associações de taxistas" },
          serviceType: "Gestão de transporte e mobilidade cooperativa",
        }),
      },
      { type: "application/ld+json", children: JSON.stringify(faqJsonLd()) },
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbJsonLd([["Início", "/"], ["Cooperativas", "/cooperativas"]])),
      },
    ],
  }),
  component: Cooperativas,
});

const BENEFICIOS = [
  { Icone: Users, titulo: "Mais ocupação", texto: "Reúna a oferta dos associados e transforme horários ociosos em rotas reserváveis." },
  { Icone: CalendarCheck, titulo: "Demanda previsível", texto: "Reservas antecipadas permitem planejar veículo, condutor e horário antes da saída." },
  { Icone: CircleDollarSign, titulo: "Financeiro transparente", texto: "Pix, cartão e espécie com taxas, repasses e histórico detalhados para a entidade." },
  { Icone: BarChart3, titulo: "Gestão em um painel", texto: "Acompanhe frota, motoristas, rotas, reservas e resultados sem planilhas dispersas." },
];

function Cooperativas() {
  const mensagem = encodeURIComponent("Olá! Represento uma cooperativa/associação e quero conhecer o piloto de 90 dias do RotaCerta. Entidade: ___ | Cidade/UF: ___ | Frota: ___ veículos.");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <section className="relative isolate overflow-hidden bg-primary text-primary-foreground">
          <img src={heroImg} alt="Veículo de transporte em uma rodovia brasileira" width={1600} height={1008} className="absolute inset-0 -z-20 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-primary/85" />
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Handshake className="size-4" /> Programa Cooperativa Pioneira
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold sm:text-6xl">Mais corridas para os associados. Mais controle para a cooperativa.</h1>
              <p className="mt-5 max-w-2xl text-base text-primary-foreground/75 sm:text-lg">
                Organize frota, rotas, reservas, pagamentos e prestação de contas em uma operação assistida — sem trocar a autonomia da entidade por mais um aplicativo genérico.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <a href="#diagnostico">Solicitar diagnóstico <ArrowRight /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  <a href={`https://wa.me/${WHATSAPP}?text=${mensagem}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> Falar com o fundador</a>
                </Button>
              </div>
            </div>
            <aside className="border-l-4 border-accent bg-primary-foreground/5 p-6">
              <p className="text-sm font-semibold text-accent">Piloto assistido de 90 dias</p>
              <ul className="mt-5 grid gap-4 text-sm text-primary-foreground/80">
                {["Sem mensalidade e sem renovação automática", "Implantação com 5 a 10 motoristas", "Treinamento da diretoria e dos associados", "Revisão semanal e relatório final de resultados"].map((item) => (
                  <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> {item}</li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="max-w-2xl"><p className="text-sm font-semibold text-accent">Resultado antes de tecnologia</p><h2 className="mt-2 text-3xl font-bold">O que muda na rotina da entidade</h2></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map(({ Icone, titulo, texto }) => <article key={titulo} className="border-t-2 border-accent bg-card p-5 shadow-[var(--shadow-card)]"><Icone className="size-5 text-accent" /><h3 className="mt-4 font-bold">{titulo}</h3><p className="mt-2 text-sm text-muted-foreground">{texto}</p></article>)}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-bold">Da decisão à primeira reserva</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-4">
              {["Diagnóstico da operação", "Acordo de metas do piloto", "Cadastro e treinamento", "Rotas ativas e revisão semanal"].map((item, index) => <li key={item} className="flex gap-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{index + 1}</span><p className="pt-2 text-sm font-semibold">{item}</p></li>)}
            </ol>
          </div>
        </section>

        <DiagnosticoCooperativa origem="pagina_cooperativas" />

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
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-2xl font-bold">Cooperativas por estado</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Veja o contexto do seu estado, as vagas do piloto e solicite o diagnóstico com a UF já preenchida.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {UFS.map((u) => (
                <li key={u.sigla}>
                  <Link
                    to="/cooperativas/$uf"
                    params={{ uf: u.sigla.toLowerCase() }}
                    className="block border border-border bg-card px-3 py-2 font-medium transition-colors hover:border-accent hover:text-accent"
                  >
                    Cooperativas em {u.nome}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-muted-foreground">
              Tem empresa com frota própria (CNPJ)?{" "}
              <Link to="/sou-frotista" className="font-semibold text-primary underline">
                Conheça a área para frotistas
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
