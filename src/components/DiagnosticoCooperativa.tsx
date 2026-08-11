import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UFS } from "@/lib/ufs";

interface Props {
  /** UF pré-selecionada (páginas por estado). */
  ufInicial?: string;
  /** Origem gravada no lead para medir qual página converteu. */
  origem?: string;
  /** Título da seção. */
  titulo?: string;
}

export function DiagnosticoCooperativa({
  ufInicial = "",
  origem = "pagina_cooperativas",
  titulo = "Conte como sua cooperativa opera hoje",
}: Props) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [uf, setUf] = useState(ufInicial);
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
      origem,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Confira os campos e tente novamente.");
      return;
    }
    setEnviado(true);
    toast.success("Diagnóstico solicitado com sucesso.");
  }

  return (
    <section id="diagnostico" className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[.75fr_1.25fr]">
      <div>
        <p className="text-sm font-semibold text-accent">Primeiro passo</p>
        <h2 className="mt-2 text-3xl font-bold">{titulo}</h2>
        <p className="mt-4 text-muted-foreground">
          O diagnóstico não cria conta nem gera cobrança. Usaremos os dados apenas para avaliar a aderência ao piloto e entrar em contato.
        </p>
        <div className="mt-6 flex gap-3 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-success" />
          <p>Contato direto, coleta mínima de dados e nenhuma renovação automática.</p>
        </div>
      </div>
      {enviado ? (
        <div className="flex min-h-80 flex-col items-center justify-center border border-success/30 bg-success/10 p-8 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <h3 className="mt-4 text-2xl font-bold">Solicitação recebida</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Analisaremos o perfil da entidade e entraremos em contato para agendar o diagnóstico.
          </p>
        </div>
      ) : (
        <form onSubmit={enviar} className="grid gap-5 border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-2 sm:p-7">
          <Campo nome="entidade" rotulo="Cooperativa ou associação" placeholder="Nome da entidade" />
          <Campo nome="cnpj" rotulo="CNPJ (opcional)" placeholder="Somente números" inputMode="numeric" />
          <Campo nome="responsavel" rotulo="Responsável" placeholder="Nome completo" />
          <Campo nome="cargo" rotulo="Cargo" placeholder="Ex.: presidente, diretor" />
          <Campo nome="telefone" rotulo="WhatsApp/telefone" placeholder="(00) 00000-0000" type="tel" />
          <Campo nome="email" rotulo="E-mail institucional" placeholder="contato@entidade.org.br" type="email" />
          <Campo nome="municipio" rotulo="Município" placeholder="Cidade sede" />
          <div className="grid gap-2">
            <Label>Estado</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger><SelectValue placeholder="Selecione a UF" /></SelectTrigger>
              <SelectContent>
                {UFS.map((item) => (
                  <SelectItem key={item.sigla} value={item.sigla}>{item.nome} ({item.sigla})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Tipo de entidade</Label>
            <Select value={segmento} onValueChange={setSegmento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cooperativa_taxi">Cooperativa de táxi</SelectItem>
                <SelectItem value="associacao_taxi">Associação de taxistas</SelectItem>
                <SelectItem value="transporte_passageiros">Transporte de passageiros</SelectItem>
                <SelectItem value="fretes_encomendas">Fretes e encomendas</SelectItem>
                <SelectItem value="outro">Outro segmento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Campo nome="associados" rotulo="Número de associados" type="number" min="1" />
          <Campo nome="veiculos" rotulo="Número de veículos" type="number" min="1" />
          <Campo nome="rotas_atuais" rotulo="Rotas atuais (aproximado)" type="number" min="0" defaultValue="0" />
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="dificuldade">Principal dificuldade hoje</Label>
            <Textarea id="dificuldade" name="dificuldade" required minLength={10} maxLength={1500} rows={4} placeholder="Ex.: baixa ocupação, organização de escalas, cobrança, prestação de contas..." />
          </div>
          <label className="flex gap-3 text-xs text-muted-foreground sm:col-span-2">
            <input type="checkbox" required className="mt-0.5 size-4 accent-primary" /> Autorizo o RotaCerta a usar estes dados para avaliar o piloto e entrar em contato sobre esta solicitação.
          </label>
          <Button type="submit" size="lg" disabled={enviando} className="sm:col-span-2">
            {enviando ? "Enviando…" : "Solicitar diagnóstico da cooperativa"} <ArrowRight />
          </Button>
        </form>
      )}
    </section>
  );
}

function Campo({ nome, rotulo, ...props }: { nome: string; rotulo: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={nome}>{rotulo}</Label>
      <Input id={nome} name={nome} required {...props} />
    </div>
  );
}
