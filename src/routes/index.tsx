import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CalendarClock,
  Luggage,
  MapPinned,
  ShieldAlert,
  Truck,
  Wallet,
} from "lucide-react";
import heroImg from "@/assets/hero-rota.jpg";
import { TopNav } from "@/components/TopNav";
import { anoMinimoPermitido } from "@/lib/logistica";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RotaViva — transporte intermunicipal agendado no Amapá" },
      {
        name: "description",
        content:
          "Plataforma de IA para reserva antecipada de assentos e bagagem em rotas entre sedes, distritos e vilarejos do Amapá. Para motoristas e passageiros.",
      },
      { property: "og:title", content: "RotaViva — transporte agendado para comunidades do Amapá" },
      {
        property: "og:description",
        content:
          "Agenda de rotas, reserva de assento com pagamento antecipado, cálculo inteligente de bagagem e tarifas calibradas por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    titulo: "Sede, distrito e vilarejo",
    texto:
      "O cadastro de rotas cobre pontos que os aplicativos urbanos ignoram — ramais, vilas e comunidades de difícil acesso.",
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
    <div className="min-h-screen bg-background">
      <TopNav />

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <img
            src={heroImg}
            alt="Van e caminhonete em ramal de terra no interior do Amapá com passageiros e bagagens"
            width={1600}
            height={1008}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,oklch(0.16_0.012_60/0.94),oklch(0.16_0.012_60/0.62))]" />
          <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              Começando pelo Amapá · expansão progressiva
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.05] text-primary-foreground sm:text-6xl">
              Transporte diário com hora marcada para quem mora longe do asfalto.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
              O RotaViva conecta motoristas de transporte alternativo e moradores de sedes,
              distritos e vilarejos. Rota cadastrada, horário definido, assento reservado e pago
              antes de embarcar.
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
                ["16", "municípios do AP"],
                ["2", "perfis: motorista e usuário"],
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
        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-bold sm:text-4xl">Como o RotaViva funciona</h2>
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
        <section className="border-t border-border bg-secondary/50">
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

      <footer className="mx-auto max-w-6xl px-5 py-10 text-xs text-muted-foreground">
        RotaViva · protótipo de plataforma de transporte agendado para comunidades do Amapá.
      </footer>
    </div>
  );
}
