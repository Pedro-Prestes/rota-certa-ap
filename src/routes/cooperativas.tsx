import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Handshake,
  MessageCircle,
  Route as RouteIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UFS } from "@/lib/ufs";

const BASE_URL = "https://rotacertabrasil.com.br";
const WHATSAPP = "5596984095871";

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
    scripts: [{
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
    }],
  }),
  component: Cooperativas,
});

const BENEFICIOS = [
  { Icone: Users, titulo: "Mais ocupação", texto: "Reúna a oferta dos associados e transforme horários ociosos em rotas reserváveis." },
  { Icone: CalendarCheck, titulo: "Demanda previsível", texto: "Reservas antecipadas permitem planejar veículo, condutor e horário antes da saída." },
  { Icone: CircleDollarSign, titulo: "Financeiro transparente", texto: "Pix, cartão e espécie com taxas, repasses e histórico detalhados para a entidade." },
  { Icone: BarChart3, titulo: "Gestão em um painel", texto: "Acompanhe frota, motoristas, rotas, reservas e resultados sem planilhas dispersas." },
];

const FAQ: Array<[string, string]> = [
  ["O piloto realmente não tem mensalidade?", "Sim. Durante 90 dias, a entidade selecionada recebe implantação e acompanhamento sem mensalidade. Não há renovação automática."],
  ["Precisamos cadastrar toda a frota de uma vez?", "Não. A implantação começa com um grupo de 5 a 10 motoristas e cresce somente após o fluxo inicial funcionar."],
  ["O que acontece ao final dos 90 dias?", "A diretoria recebe um relatório dos resultados. A continuidade paga só é proposta depois dessa revisão e depende da aprovação da entidade."],
  ["Como os dados são protegidos?", "O acesso é compartimentado por perfil, com biometria, regras de visibilidade e registros auditáveis. A coleta comercial segue o princípio de dados mínimos."],
  ["A cooperativa perde sua autonomia?", "Não. A entidade mantém suas regras e operação. O RotaCerta organiza a tecnologia, os registros e os fluxos acordados para o piloto."],
];

function Cooperativas() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [uf, setUf] = useState("");
  const [segmento, setSegmento] = useState("cooperativa_taxi");

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!uf) {
      toast.error("Selecione o estado da entidade.");
      return;
    }
    setEnviando(true);
    const cnpj = String(form.get("cnpj") ?? "").replace(/\D/g, "");
    const { error } = await supabase.from("parcerias_leads").insert({
      entidade: String(form.get("entidade") ?? "").trim(),
      cnpj: cnpj || null,
      responsavel: String(form.get("responsavel") ?? "").trim(),
      cargo: String(form.get("cargo") ?? "").trim(),
      telefone: String(form.get("telefone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      municipio: String(form.get("municipio") ?? "").trim(),
      uf,
      segmento,
      associados: Number(form.get("associados")),
      veiculos: Number(form.get("veiculos")),
      rotas_atuais: Number(form.get("rotas_atuais") ?? 0),
      dificuldade: String(form.get("dificuldade") ?? "").trim(),
      interesse_piloto: true,
      consentimento_contato: true,
      origem: "pagina_cooperativas",
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Confira os campos e tente novamente.");
      return;
    }
    setEnviado(true);
    toast.success("Diagnóstico solicitado com sucesso.");
  }

  const mensagem = encodeURIComponent("Olá! Represento uma cooperativa/associação e quero conhecer o piloto de 90 dias do RotaCerta. Entidade: ___ | Cidade/UF: ___ | Frota: ___ veículos.");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <section className="surface-night overflow-hidden">
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

        <section id="diagnostico" className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[.75fr_1.25fr]">
          <div><p className="text-sm font-semibold text-accent">Primeiro passo</p><h2 className="mt-2 text-3xl font-bold">Conte como sua cooperativa opera hoje</h2><p className="mt-4 text-muted-foreground">O diagnóstico não cria conta nem gera cobrança. Usaremos os dados apenas para avaliar a aderência ao piloto e entrar em contato.</p><div className="mt-6 flex gap-3 text-sm"><ShieldCheck className="size-5 shrink-0 text-success" /><p>Contato direto, coleta mínima de dados e nenhuma renovação automática.</p></div></div>
          {enviado ? (
            <div className="flex min-h-80 flex-col items-center justify-center border border-success/30 bg-success/10 p-8 text-center"><CheckCircle2 className="size-12 text-success" /><h3 className="mt-4 text-2xl font-bold">Solicitação recebida</h3><p className="mt-2 max-w-md text-muted-foreground">Analisaremos o perfil da entidade e entraremos em contato para agendar o diagnóstico.</p></div>
          ) : (
            <form onSubmit={enviar} className="grid gap-5 border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-2 sm:p-7">
              <Campo nome="entidade" rotulo="Cooperativa ou associação" placeholder="Nome da entidade" />
              <Campo nome="cnpj" rotulo="CNPJ (opcional)" placeholder="Somente números" inputMode="numeric" />
              <Campo nome="responsavel" rotulo="Responsável" placeholder="Nome completo" />
              <Campo nome="cargo" rotulo="Cargo" placeholder="Ex.: presidente, diretor" />
              <Campo nome="telefone" rotulo="WhatsApp/telefone" placeholder="(00) 00000-0000" type="tel" />
              <Campo nome="email" rotulo="E-mail institucional" placeholder="contato@entidade.org.br" type="email" />
              <Campo nome="municipio" rotulo="Município" placeholder="Cidade sede" />
              <div className="grid gap-2"><Label>Estado</Label><Select value={uf} onValueChange={setUf}><SelectTrigger><SelectValue placeholder="Selecione a UF" /></SelectTrigger><SelectContent>{UFS.map((item) => <SelectItem key={item.sigla} value={item.sigla}>{item.nome} ({item.sigla})</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2 sm:col-span-2"><Label>Tipo de entidade</Label><Select value={segmento} onValueChange={setSegmento}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cooperativa_taxi">Cooperativa de táxi</SelectItem><SelectItem value="associacao_taxi">Associação de taxistas</SelectItem><SelectItem value="transporte_passageiros">Transporte de passageiros</SelectItem><SelectItem value="fretes_encomendas">Fretes e encomendas</SelectItem><SelectItem value="outro">Outro segmento</SelectItem></SelectContent></Select></div>
              <Campo nome="associados" rotulo="Número de associados" type="number" min="1" />
              <Campo nome="veiculos" rotulo="Número de veículos" type="number" min="1" />
              <Campo nome="rotas_atuais" rotulo="Rotas atuais (aproximado)" type="number" min="0" defaultValue="0" />
              <div className="grid gap-2 sm:col-span-2"><Label htmlFor="dificuldade">Principal dificuldade hoje</Label><Textarea id="dificuldade" name="dificuldade" required minLength={10} maxLength={1500} rows={4} placeholder="Ex.: baixa ocupação, organização de escalas, cobrança, prestação de contas..." /></div>
              <label className="flex gap-3 text-xs text-muted-foreground sm:col-span-2"><input type="checkbox" required className="mt-0.5 size-4 accent-primary" /> Autorizo o RotaCerta a usar estes dados para avaliar o piloto e entrar em contato sobre esta solicitação.</label>
              <Button type="submit" size="lg" disabled={enviando} className="sm:col-span-2">{enviando ? "Enviando…" : "Solicitar diagnóstico da cooperativa"} <ArrowRight /></Button>
            </form>
          )}
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-20"><h2 className="text-2xl font-bold">Dúvidas da diretoria</h2><Accordion type="single" collapsible className="mt-5">{FAQ.map(([pergunta, resposta]) => <AccordionItem key={pergunta} value={pergunta}><AccordionTrigger>{pergunta}</AccordionTrigger><AccordionContent className="text-muted-foreground">{resposta}</AccordionContent></AccordionItem>)}</Accordion></section>
      </main>
    </div>
  );
}

function Campo({ nome, rotulo, ...props }: { nome: string; rotulo: string } & React.ComponentProps<typeof Input>) {
  return <div className="grid gap-2"><Label htmlFor={nome}>{rotulo}</Label><Input id={nome} name={nome} required {...props} /></div>;
}