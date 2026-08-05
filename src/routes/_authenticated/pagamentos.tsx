import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import {
  FORMAS,
  STATUS,
  brl,
  liquidoPagamento,
  resumoCorrida,
  rotuloForma,
  rotuloStatus,
  taxaSugerida,
  type Corrida,
  type FormaPagamento,
  type Pagamento,
  type StatusPagamento,
} from "@/lib/pagamentos";
import { CheckoutCorrida } from "@/components/CheckoutCorrida";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { cobrancaOnlineDisponivel } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos por corrida — RotaCerta" },
      {
        name: "description",
        content:
          "Registre e edite o pagamento de cada corrida no Pix, cartão de crédito, cartão de débito ou dinheiro, com taxas, comissão e líquido do motorista.",
      },
      { property: "og:title", content: "Pagamentos por corrida — RotaCerta" },
      {
        property: "og:description",
        content: "Contabilidade detalhada por corrida: formas de pagamento, taxas, troco e repasse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagamentos,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

const iconeForma = {
  pix: QrCode,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
} as const;

const corridaVazia = () => ({
  passageiro_nome: "",
  motorista_nome: "",
  veiculo: "",
  origem: "",
  destino: "",
  data_corrida: new Date().toISOString().slice(0, 10),
  hora_partida: "",
  hora_chegada: "",
  distancia_km: 0,
  assentos: 1,
  bagagem_l: 0,
  valor_tarifa: 0,
  valor_bagagem: 0,
  valor_pedagios: 0,
  valor_extras: 0,
  desconto: 0,
  comissao_percentual: 15,
  observacoes: "",
});

const pagamentoVazio = () => ({
  forma: "pix" as FormaPagamento,
  status: "pago" as StatusPagamento,
  valor: 0,
  taxa_percentual: taxaSugerida("pix"),
  parcelas: 1,
  bandeira: "",
  autorizacao: "",
  chave_pix: "",
  valor_recebido: 0,
  troco: 0,
  pago_em: new Date().toISOString().slice(0, 16),
  observacoes: "",
});

function Pagamentos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editandoCorrida, setEditandoCorrida] = useState<Corrida | "nova" | null>(null);
  const [editandoPagamento, setEditandoPagamento] = useState<
    { corridaId: string; pagamento: Pagamento | null } | null
  >(null);
  const [cobrando, setCobrando] = useState<{ corridaId: string; valorBase: number } | null>(null);
  const onlineDisponivel = cobrancaOnlineDisponivel();

  const corridas = useQuery({
    queryKey: ["corridas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corridas")
        .select("*")
        .order("data_corrida", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Corrida[];
    },
  });

  const pagamentos = useQuery({
    queryKey: ["pagamentos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .order("pago_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pagamento[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["corridas"] });
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  const excluirCorrida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("corridas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Corrida excluída.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirPagamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento excluído.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = corridas.data ?? [];
  const todosPagamentos = pagamentos.data ?? [];

  const totais = useMemo(() => {
    return lista.reduce(
      (acc, c) => {
        const r = resumoCorrida(
          c,
          todosPagamentos.filter((p) => p.corrida_id === c.id),
        );
        acc.total += r.total;
        acc.recebido += r.recebido;
        acc.pendente += r.pendente;
        acc.taxas += r.taxas;
        acc.liquido += r.liquidoMotorista;
        return acc;
      },
      { total: 0, recebido: 0, pendente: 0, taxas: 0, liquido: 0 },
    );
  }, [lista, todosPagamentos]);

  const porForma = useMemo(() => {
    return FORMAS.map((f) => ({
      ...f,
      valor: todosPagamentos
        .filter((p) => p.forma === f.id && p.status === "pago")
        .reduce((a, p) => a + Number(p.valor ?? 0), 0),
    }));
  }, [todosPagamentos]);

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Pagamentos por corrida</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pix, cartão de crédito, cartão de débito e dinheiro — cada corrida com o detalhamento
              completo e editável.
            </p>
          </div>
          <button
            onClick={() => setEditandoCorrida("nova")}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Nova corrida
          </button>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Faturado", totais.total],
            ["Recebido", totais.recebido],
            ["A receber", totais.pendente],
            ["Taxas", totais.taxas],
            ["Líquido motorista", totais.liquido],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold">{brl(v as number)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {porForma.map((f) => {
            const Icone = iconeForma[f.id];
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Icone className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{f.rotulo}</p>
                  <p className="font-bold">{brl(f.valor)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 space-y-4">
          {corridas.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!corridas.isLoading && lista.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Receipt className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhuma corrida lançada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie a primeira corrida para registrar os pagamentos.
              </p>
            </div>
          )}

          {lista.map((c) => {
            const pags = todosPagamentos.filter((p) => p.corrida_id === c.id);
            const r = resumoCorrida(c, pags);
            return (
              <article key={c.id} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-start gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {c.origem || "—"} → {c.destino || "—"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(`${c.data_corrida}T00:00:00`).toLocaleDateString("pt-BR")}
                      {c.hora_partida ? ` · ${c.hora_partida.slice(0, 5)}` : ""}
                      {c.passageiro_nome ? ` · ${c.passageiro_nome}` : ""}
                      {c.motorista_nome ? ` · motorista ${c.motorista_nome}` : ""}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        r.pendente > 0.004
                          ? "bg-destructive/10 text-destructive"
                          : "bg-accent/15 text-accent"
                      }`}
                    >
                      {r.pendente > 0.004 ? `Falta ${brl(r.pendente)}` : "Quitada"}
                    </span>
                    <button
                      onClick={() => setEditandoCorrida(c)}
                      className="rounded-full border border-border p-2"
                      aria-label="Editar corrida"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => excluirCorrida.mutate(c.id)}
                      className="rounded-full border border-border p-2 text-destructive"
                      aria-label="Excluir corrida"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 rounded-xl bg-secondary/50 p-4 text-sm sm:grid-cols-4">
                  {[
                    ["Tarifa", brl(Number(c.valor_tarifa))],
                    ["Bagagem", brl(Number(c.valor_bagagem))],
                    ["Pedágios", brl(Number(c.valor_pedagios))],
                    ["Extras", brl(Number(c.valor_extras))],
                    ["Desconto", `- ${brl(r.desconto)}`],
                    ["Total da corrida", brl(r.total)],
                    ["Taxas das maquininhas", brl(r.taxas)],
                    [`Comissão (${Number(c.comissao_percentual)}%)`, brl(r.comissao)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="font-semibold">{v}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-4 border-t border-border pt-3">
                    <dt className="text-xs text-muted-foreground">Líquido do motorista</dt>
                    <dd className="text-lg font-bold text-accent">{brl(r.liquidoMotorista)}</dd>
                  </div>
                </dl>

                <div className="mt-5 space-y-2">
                  {pags.map((p) => {
                    const Icone = iconeForma[p.forma];
                    return (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                      >
                        <Icone className="size-4 text-accent" />
                        <span className="font-semibold">{rotuloForma(p.forma)}</span>
                        {p.forma === "credito" && p.parcelas > 1 && (
                          <span className="text-muted-foreground">{p.parcelas}x</span>
                        )}
                        {p.bandeira && <span className="text-muted-foreground">{p.bandeira}</span>}
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {rotuloStatus(p.status)}
                        </span>
                        <span className="text-muted-foreground">
                          taxa {Number(p.taxa_percentual)}% · líquido {brl(liquidoPagamento(p))}
                        </span>
                        {p.forma === "dinheiro" && Number(p.troco) > 0 && (
                          <span className="text-muted-foreground">troco {brl(Number(p.troco))}</span>
                        )}
                        <span className="ml-auto font-bold">{brl(Number(p.valor))}</span>
                        <button
                          onClick={() => setEditandoPagamento({ corridaId: c.id, pagamento: p })}
                          className="rounded-full border border-border p-1.5"
                          aria-label="Editar pagamento"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => excluirPagamento.mutate(p.id)}
                          className="rounded-full border border-border p-1.5 text-destructive"
                          aria-label="Excluir pagamento"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEditandoPagamento({ corridaId: c.id, pagamento: null })}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold"
                    >
                      <Wallet className="size-4" /> Lançar pagamento
                    </button>
                    {onlineDisponivel && r.pendente > 0.004 && (
                      <button
                        onClick={() => setCobrando({ corridaId: c.id, valorBase: r.pendente })}
                        className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
                      >
                        <QrCode className="size-4" /> Cobrar online (Pix ou cartão)
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {editandoCorrida && user && (
        <FormularioCorrida
          userId={user.id}
          corrida={editandoCorrida === "nova" ? null : editandoCorrida}
          onFechar={() => setEditandoCorrida(null)}
          onSalvo={() => {
            setEditandoCorrida(null);
            invalidar();
          }}
        />
      )}

      {cobrando && (
        <CheckoutCorrida
          corridaId={cobrando.corridaId}
          valorBase={cobrando.valorBase}
          onFechar={() => setCobrando(null)}
        />
      )}

      {editandoPagamento && user && (
        <FormularioPagamento
          userId={user.id}
          corridaId={editandoPagamento.corridaId}
          pagamento={editandoPagamento.pagamento}
          onFechar={() => setEditandoPagamento(null)}
          onSalvo={() => {
            setEditandoPagamento(null);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

function Modal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <button onClick={onFechar} className="ml-auto rounded-full border border-border p-2">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormularioCorrida({
  userId,
  corrida,
  onFechar,
  onSalvo,
}: {
  userId: string;
  corrida: Corrida | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [f, setF] = useState(() =>
    corrida
      ? {
          ...corridaVazia(),
          ...corrida,
          veiculo: corrida.veiculo ?? "",
          hora_partida: corrida.hora_partida?.slice(0, 5) ?? "",
          hora_chegada: corrida.hora_chegada?.slice(0, 5) ?? "",
          observacoes: corrida.observacoes ?? "",
        }
      : corridaVazia(),
  );
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        passageiro_nome: f.passageiro_nome,
        motorista_nome: f.motorista_nome,
        veiculo: f.veiculo || null,
        origem: f.origem,
        destino: f.destino,
        data_corrida: f.data_corrida,
        hora_partida: f.hora_partida || null,
        hora_chegada: f.hora_chegada || null,
        distancia_km: Number(f.distancia_km) || 0,
        assentos: Number(f.assentos) || 1,
        bagagem_l: Number(f.bagagem_l) || 0,
        valor_tarifa: Number(f.valor_tarifa) || 0,
        valor_bagagem: Number(f.valor_bagagem) || 0,
        valor_pedagios: Number(f.valor_pedagios) || 0,
        valor_extras: Number(f.valor_extras) || 0,
        desconto: Number(f.desconto) || 0,
        comissao_percentual: Number(f.comissao_percentual) || 0,
        observacoes: f.observacoes || null,
      };
      const resposta = corrida
        ? await supabase.from("corridas").update(payload).eq("id", corrida.id)
        : await supabase.from("corridas").insert(payload);
      if (resposta.error) throw resposta.error;
    },
    onSuccess: () => {
      toast.success(corrida ? "Corrida atualizada." : "Corrida criada.");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo={corrida ? "Editar corrida" : "Nova corrida"} onFechar={onFechar}>
      <form
        className="mt-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <div>
          <label className={rotulo}>Passageiro</label>
          <input
            className={campo}
            value={f.passageiro_nome}
            onChange={(e) => set("passageiro_nome", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Motorista</label>
          <input
            className={campo}
            value={f.motorista_nome}
            onChange={(e) => set("motorista_nome", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Origem</label>
          <input className={campo} value={f.origem} onChange={(e) => set("origem", e.target.value)} />
        </div>
        <div>
          <label className={rotulo}>Destino</label>
          <input
            className={campo}
            value={f.destino}
            onChange={(e) => set("destino", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Veículo</label>
          <input
            className={campo}
            value={f.veiculo}
            onChange={(e) => set("veiculo", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Data</label>
          <input
            type="date"
            className={campo}
            value={f.data_corrida}
            onChange={(e) => set("data_corrida", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Partida</label>
          <input
            type="time"
            className={campo}
            value={f.hora_partida}
            onChange={(e) => set("hora_partida", e.target.value)}
          />
        </div>
        <div>
          <label className={rotulo}>Chegada</label>
          <input
            type="time"
            className={campo}
            value={f.hora_chegada}
            onChange={(e) => set("hora_chegada", e.target.value)}
          />
        </div>
        {(
          [
            ["distancia_km", "Distância (km)"],
            ["assentos", "Assentos"],
            ["bagagem_l", "Bagagem (L)"],
            ["valor_tarifa", "Tarifa (R$)"],
            ["valor_bagagem", "Bagagem (R$)"],
            ["valor_pedagios", "Pedágios (R$)"],
            ["valor_extras", "Extras (R$)"],
            ["desconto", "Desconto (R$)"],
            ["comissao_percentual", "Comissão da plataforma (%)"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className={rotulo}>{label}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={campo}
              value={f[k]}
              onChange={(e) => set(k, e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className={rotulo}>Observações</label>
          <textarea
            className={campo}
            rows={3}
            value={f.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvar.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando…" : "Salvar corrida"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormularioPagamento({
  userId,
  corridaId,
  pagamento,
  onFechar,
  onSalvo,
}: {
  userId: string;
  corridaId: string;
  pagamento: Pagamento | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [f, setF] = useState(() =>
    pagamento
      ? {
          ...pagamentoVazio(),
          ...pagamento,
          bandeira: pagamento.bandeira ?? "",
          autorizacao: pagamento.autorizacao ?? "",
          chave_pix: pagamento.chave_pix ?? "",
          valor_recebido: Number(pagamento.valor_recebido ?? 0),
          observacoes: pagamento.observacoes ?? "",
          pago_em: new Date(pagamento.pago_em).toISOString().slice(0, 16),
        }
      : pagamentoVazio(),
  );
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const trocoCalculado = Math.max(0, Number(f.valor_recebido || 0) - Number(f.valor || 0));

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        corrida_id: corridaId,
        forma: f.forma,
        status: f.status,
        valor: Number(f.valor) || 0,
        taxa_percentual: Number(f.taxa_percentual) || 0,
        parcelas: f.forma === "credito" ? Number(f.parcelas) || 1 : 1,
        bandeira: f.forma === "credito" || f.forma === "debito" ? f.bandeira || null : null,
        autorizacao: f.autorizacao || null,
        chave_pix: f.forma === "pix" ? f.chave_pix || null : null,
        valor_recebido: f.forma === "dinheiro" ? Number(f.valor_recebido) || 0 : null,
        troco: f.forma === "dinheiro" ? trocoCalculado : 0,
        pago_em: new Date(f.pago_em).toISOString(),
        observacoes: f.observacoes || null,
      };
      const resposta = pagamento
        ? await supabase.from("pagamentos").update(payload).eq("id", pagamento.id)
        : await supabase.from("pagamentos").insert(payload);
      if (resposta.error) throw resposta.error;
    },
    onSuccess: () => {
      toast.success(pagamento ? "Pagamento atualizado." : "Pagamento lançado.");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo={pagamento ? "Editar pagamento" : "Lançar pagamento"} onFechar={onFechar}>
      <form
        className="mt-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        <div className="sm:col-span-2">
          <label className={rotulo}>Forma de pagamento</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMAS.map((forma) => {
              const Icone = iconeForma[forma.id];
              const ativo = f.forma === forma.id;
              return (
                <button
                  key={forma.id}
                  type="button"
                  onClick={() =>
                    setF((p) => ({
                      ...p,
                      forma: forma.id,
                      parcelas: forma.id === "credito" ? p.parcelas : 1,
                      taxa_percentual: taxaSugerida(
                        forma.id,
                        forma.id === "credito" ? p.parcelas : 1,
                      ),
                    }))
                  }
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    ativo
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icone className="size-4" /> {forma.rotulo}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={rotulo}>Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={campo}
            value={f.valor}
            onChange={(e) => set("valor", e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </div>
        <div>
          <label className={rotulo}>Situação</label>
          <select
            className={campo}
            value={f.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>

        {f.forma === "credito" && (
          <div>
            <label className={rotulo}>Parcelas</label>
            <select
              className={campo}
              value={f.parcelas}
              onChange={(e) =>
                setF((p) => ({
                  ...p,
                  parcelas: Number(e.target.value),
                  taxa_percentual: taxaSugerida("credito", Number(e.target.value)),
                }))
              }
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </div>
        )}

        {(f.forma === "credito" || f.forma === "debito") && (
          <>
            <div>
              <label className={rotulo}>Bandeira</label>
              <input
                className={campo}
                placeholder="Visa, Mastercard, Elo…"
                value={f.bandeira}
                onChange={(e) => set("bandeira", e.target.value)}
              />
            </div>
            <div>
              <label className={rotulo}>Código de autorização</label>
              <input
                className={campo}
                value={f.autorizacao}
                onChange={(e) => set("autorizacao", e.target.value)}
              />
            </div>
          </>
        )}

        {f.forma === "pix" && (
          <>
            <div>
              <label className={rotulo}>Chave Pix recebedora</label>
              <input
                className={campo}
                value={f.chave_pix}
                onChange={(e) => set("chave_pix", e.target.value)}
              />
            </div>
            <div>
              <label className={rotulo}>Identificador (E2E / txid)</label>
              <input
                className={campo}
                value={f.autorizacao}
                onChange={(e) => set("autorizacao", e.target.value)}
              />
            </div>
          </>
        )}

        {f.forma === "dinheiro" && (
          <>
            <div>
              <label className={rotulo}>Valor entregue (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={campo}
                value={f.valor_recebido}
                onChange={(e) =>
                  set("valor_recebido", e.target.value === "" ? 0 : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className={rotulo}>Troco</label>
              <input className={`${campo} bg-secondary`} readOnly value={brl(trocoCalculado)} />
            </div>
          </>
        )}

        <div>
          <label className={rotulo}>Taxa da operação (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={campo}
            value={f.taxa_percentual}
            onChange={(e) =>
              set("taxa_percentual", e.target.value === "" ? 0 : Number(e.target.value))
            }
          />
        </div>
        <div>
          <label className={rotulo}>Data e hora do pagamento</label>
          <input
            type="datetime-local"
            className={campo}
            value={f.pago_em}
            onChange={(e) => set("pago_em", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={rotulo}>Observações</label>
          <textarea
            className={campo}
            rows={2}
            value={f.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
          />
        </div>

        <p className="sm:col-span-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
          Líquido após a taxa:{" "}
          <strong>
            {brl(Number(f.valor || 0) - (Number(f.valor || 0) * Number(f.taxa_percentual || 0)) / 100)}
          </strong>
        </p>

        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvar.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando…" : "Salvar pagamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
