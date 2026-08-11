import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CalendarClock,
  Gift,
  Globe2,
  Luggage,
  Mail,
  MapPinned,
  ShieldAlert,
  Truck,
  Wallet,
} from "lucide-react";
import heroImg from "@/assets/hero-rota.jpg";
import { TopNav } from "@/components/TopNav";
import { WhatsAppLink } from "@/components/WhatsAppContato";
import { anoMinimoPermitido } from "@/lib/logistica";
import { UFS } from "@/lib/ufs";
import { useQuery } from "@tanstack/react-query";
import { consultarVagasPromo } from "@/utils/promocao.functions";

/** Faixa do lançamento promocional: mês grátis para os 10 primeiros por estado. */
function PromoLancamento() {
  const vagas = useQuery({
    queryKey: ["promo-vagas"],
    staleTime: 1000 * 60 * 5,
    queryFn: () => consultarVagasPromo(),
  });
  if (!vagas.data?.ativa) return null;
  const abertas = vagas.data.ufs.filter((u) => u.restantes > 0);
  const total = abertas.reduce((s, u) => s + u.restantes, 0);
  if (total === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 pt-16">
      <div className="rounded-3xl border border-primary/25 bg-primary/10 p-6 backdrop-blur-sm sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          <Gift className="size-3.5" /> Lançamento nacional
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold sm:text-3xl">
          {vagas.data.vagasPorUf} primeiros motoristas de cada estado: {vagas.data.dias} dias de
          Motorista Pro sem custo
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Publique sua primeira rota e a mensalidade do plano é por nossa conta — taxa administrativa
          reduzida em todas as corridas, sem cobrança automática no fim do período. Restam{" "}
          <strong className="text-foreground">{total}</strong> vagas em {abertas.length} estados.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {abertas.slice(0, 14).map((u) => (
            <span
              key={u.uf}
              className="rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs font-semibold"
            >
              {u.uf} · {u.restantes}
            </span>
          ))}
          {abertas.length > 14 && (
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              +{abertas.length - 14} estados
            </span>
          )}
        </div>
        <Link
          to="/motorista"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Garantir minha vaga <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RotaCerta — transporte intermunicipal e interestadual" },
      {
        name: "description",
        content:
          "Plataforma de IA para reserva antecipada de assentos e bagagem em rotas municipais e interestaduais em todo o Brasil. Para motoristas e passageiros.",
      },
      { property: "og:title", content: "RotaCerta — transporte intermunicipal e interestadual" },
      {
        property: "og:description",
        content:
          "Plataforma de IA para reserva antecipada de assentos e bagagem em rotas municipais e interestaduais em todo o Brasil. Para motoristas e passageiros.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rotacertabrasil.com.br/" },
      { property: "og:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://rotacertabrasil.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://rotacertabrasil.com.br/#organizacao",
              name: "RotaCerta Brasil",
              url: "https://rotacertabrasil.com.br/",
              logo: "https://rotacertabrasil.com.br/icon-512.png",
              email: "rotacertabrasil@rotacertabrasil.com.br",
              areaServed: "BR",
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "atendimento ao cliente",
                  email: "suporte@rotacertabrasil.com.br",
                  telephone: "+55 96 98409-5871",
                  availableLanguage: ["pt-BR"],
                },
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://rotacertabrasil.com.br/#site",
              url: "https://rotacertabrasil.com.br/",
              name: "RotaCerta Brasil",
              inLanguage: "pt-BR",
              publisher: { "@id": "https://rotacertabrasil.com.br/#organizacao" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Como funciona o transporte com hora marcada?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "O motorista publica a rota com horário de partida e de retorno. O passageiro reserva assento e bagagem com antecedência e o horário de partida programado é inviolável.",
                  },
                },
                {
                  "@type": "Question",
                  name: "O que é o embarque acordado?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "O passageiro informa o endereço de embarque e a plataforma calcula por georreferenciamento o desvio em quilômetros e minutos, mostrando o valor do assento antes do envio da proposta ao motorista.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Quais formas de pagamento são aceitas?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Pix, cartões de crédito e débito de todas as bandeiras e pagamento em espécie, com taxa administrativa demonstrada em cada transação.",
                  },
                },
                {
                  "@type": "Question",
                  name: "O que acontece se o veículo tiver uma pane?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Com a Proteção RotaCerta, um veículo substituto é enviado para dar continuidade à viagem dos passageiros e o veículo em pane é rebocado até a oficina indicada pelo condutor.",
                  },
                },
                {
                  "@type": "Question",
                  name: "O RotaCerta atende rotas interestaduais?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Sim. A plataforma tem cobertura nacional, com rotas intermunicipais e interestaduais em todos os estados brasileiros.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),

  component: Home,
});

const pilares = [
  {
    icon: CalendarClock,
    titulo: "Agenda, não corrida",
    texto:
      "O motorista publica a rota com horário de partida e chegada, ida e retorno. O passageiro reserva o dia e o horário com antecedência.",
  },
  {
    icon: Wallet,
    titulo: "Assento garantido, pago antes",
    texto:
      "A lotação só é confirmada com pagamento antecipado. Isso protege a viagem do motorista e o lugar do passageiro.",
  },
  {
    icon: Luggage,
    titulo: "Bagagem calculada por equação",
    texto:
      "A IA converte as medidas em litros, aplica o fator de empacotamento e diz se cabe na franquia de mão ou exige utilitário.",
  },
  {
    icon: ShieldAlert,
    titulo: "Aviso de pane e folga",
    texto:
      "Pane, folga ou força maior: o motorista registra e todos os passageiros da rota são notificados com reembolso automático.",
  },
  {
    icon: MapPinned,
    titulo: "Sede, distrito, vilarejo e outro estado",
    texto:
      "UF + município do IBGE em todo o país, inclusive rotas interestaduais e pontos que os aplicativos urbanos ignoram — ramais, vilas e comunidades de difícil acesso.",
  },
  {
    icon: Brain,
    titulo: "Tarifa calibrada por IA",
    texto:
      "Após os primeiros motoristas cadastrados, o modelo estima o custo real do trecho e sugere a faixa de preço da região.",
  },
];

function Home() {
  return (
    <div className="fundo-mesh min-h-screen">
      <TopNav />

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <img
            src={heroImg}
            alt="Van de transporte intermunicipal em estrada sinuosa do interior brasileiro ao pôr do sol"
            width={1600}
            height={1008}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,oklch(0.16_0.012_60/0.94),oklch(0.16_0.012_60/0.62))]" />
          <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              Cobertura nacional · todos os estados brasileiros
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.05] text-primary-foreground sm:text-6xl">
              Transporte intermunicipal e interestadual com hora marcada.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
              O RotaCerta conecta motoristas de transporte alternativo e moradores de sedes,
              distritos e vilarejos — dentro do estado ou cruzando fronteiras entre UFs. Rota
              cadastrada, horário definido, assento reservado e pago antes de embarcar.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/passageiro"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5"
              >
                Reservar um assento <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/motorista"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                Cadastrar minha rota
              </Link>
            </div>

            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {[
                ["27", "estados + Distrito Federal"],
                ["5.570", "municípios disponíveis"],
                ["100%", "reserva paga antes"],
                [`${anoMinimoPermitido()}+`, "ano mínimo do veículo"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold text-accent">{n}</dt>
                  <dd className="text-xs text-primary-foreground/65">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <PromoLancamento />



        {/* Cobertura nacional */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Globe2 className="size-3.5" /> Cobertura nacional
              </span>
              <h2 className="mt-5 text-3xl font-bold sm:text-4xl">
                Do ramal do interior à rota entre estados
              </h2>
              <p className="mt-4 text-muted-foreground">
                A rota é cadastrada com estado (UF) e município da base oficial do IBGE. Quando o
                Ponto A e o Ponto B ficam em estados diferentes, a viagem é publicada como{" "}
                <strong className="text-foreground">interestadual</strong> — com o mesmo horário
                marcado, o mesmo assento pago antes e o mesmo acordo de ponto de embarque.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Município oficial do IBGE em todas as 27 unidades federativas.",
                  "Rotas interestaduais com Ponto A e Ponto B em UFs distintas.",
                  "Distância A → B medida automaticamente pela malha viária real.",
                  "Cidades homônimas resolvidas pela UF informada no cadastro.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-card)]">
              {(["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const).map((regiao) => (
                <div key={regiao} className="mb-5 last:mb-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {regiao}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {UFS.filter((u) => u.regiao === regiao).map((u) => (
                      <Link
                        key={u.sigla}
                        to="/motorista/$uf"
                        params={{ uf: u.sigla.toLowerCase() }}
                        title={`Seja motorista no ${u.nome}`}
                        className="rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[11px] font-semibold transition-colors hover:border-primary hover:text-primary"
                      >
                        {u.sigla}
                      </Link>
                    ))}

                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Dois usos */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Para que serve, com todas as letras</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Duas utilidades declaradas na plataforma — sem letras miúdas, sem cobrança surpresa no
            embarque.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <article className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
              <Luggage className="size-8 text-accent" />
              <h3 className="mt-5 text-xl font-bold">Passageiro com bagagem de mão</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Viagem em veículo de passageiros com franquia de 45 L e 10 kg por assento. Ideal
                para o deslocamento diário de trabalho, estudo e saúde entre a sede e os distritos.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
              <Truck className="size-8 text-accent" />
              <h3 className="mt-5 text-xl font-bold">Contratação de utilitário</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Volumes maiores — feira, mudança, insumos, equipamentos — em utilitários de pequeno,
                médio e grande porte, conduzindo carga e passageiros na mesma reserva.
              </p>
            </article>
          </div>
        </section>

        {/* Pilares */}
        <section className="border-y border-border bg-secondary/40 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-bold sm:text-4xl">Como o RotaCerta funciona</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pilares.map((p) => (
                <div key={p.titulo} className="rounded-2xl border border-border bg-card p-6">
                  <p.icon className="size-5 text-accent" />
                  <h3 className="mt-4 text-base font-bold">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Regras da frota */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">Frota com regra clara</h2>
              <p className="mt-4 text-muted-foreground">
                Só ingressa na plataforma o veículo com no máximo 10 anos de fabricação, contados a
                partir do ano vigente. Em {new Date().getFullYear()}, isso significa modelos{" "}
                <strong className="text-foreground">{anoMinimoPermitido()} ou mais novos</strong>.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Documento do veículo, CNH com EAR e vistoria anual.",
                  "Capacidade de bagageiro e carga útil declaradas no cadastro.",
                  "Classe do veículo define o teto de volume aceito na reserva.",
                  "Rotas de ida e de retorno cadastradas com horários próprios.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border surface-night p-8 text-primary-foreground shadow-[var(--shadow-lift)]">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Equação da tarifa
              </p>
              <pre className="mt-4 overflow-x-auto font-mono text-[13px] leading-7 text-primary-foreground/85">{`C = D·(Pc/Kc) + D·Cm·(1 + β·δ)
    + T·Ct + Cf

Pa = C / (N · ρ) · (1 + m)`}</pre>
              <p className="mt-4 text-xs leading-relaxed text-primary-foreground/60">
                D distância · Pc preço do combustível · Kc consumo · Cm manutenção por km · δ
                dificuldade da via (0 a 1) · T travessias · N assentos · ρ ocupação histórica · m
                margem. A IA recalibra β, Cm e ρ à medida que motoristas e viagens reais entram na
                base.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-secondary/40 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Escolha por onde entrar</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Duas experiências, a mesma simplicidade de um app de mobilidade urbana.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/passageiro"
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                Área do passageiro
              </Link>
              <Link
                to="/motorista"
                className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold"
              >
                Área do motorista
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-6 border-t border-border pt-10 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-md text-xs text-muted-foreground">
            RotaCerta · plataforma de transporte agendado para comunidades de todo o Brasil.
          </p>
          <div className="flex flex-col gap-3 text-xs">
            <p className="font-semibold text-foreground">Apoio aos usuários</p>
            <a
              href="mailto:rotacertabrasil@rotacertabrasil.com.br"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent"
            >
              <Mail className="size-3.5" />
              rotacertabrasil@rotacertabrasil.com.br
            </a>
            <a
              href="mailto:suporte@rotacertabrasil.com.br"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent"
            >
              <Mail className="size-3.5" />
              suporte@rotacertabrasil.com.br
            </a>
            <WhatsAppLink className="text-muted-foreground hover:text-[#25D366]" />
          </div>
        </div>
      </footer>
    </div>
  );
}
