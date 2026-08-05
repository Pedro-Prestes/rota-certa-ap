import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Calculator,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sliders,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useAuth } from "@/hooks/use-auth";
import { brl, type Corrida, type Pagamento } from "@/lib/pagamentos";
import {
  CATEGORIAS_CUSTO,
  CONFIG_PADRAO,
  comporCobranca,
  rotuloCategoria,
  rotuloTipo,
  sinalTipo,
  type ConfigTaxa,
} from "@/lib/taxas";
import { getStripeEnvironment } from "@/lib/stripe";
import { estornarPagamento } from "@/utils/contabil.functions";

export const Route = createFileRoute("/_authenticated/contabil")({
  head: () => ({
    meta: [
      { title: "Controle contábil — RotaCerta" },
      {
        name: "description",
        content:
          "Módulo contábil do administrador master do RotaCerta: taxa administrativa, custos de terceiros, estornos integrais ou parciais e demonstrativo de resultado.",
      },
      { property: "og:title", content: "Controle contábil — RotaCerta" },
      {
        property: "og:description",
        content:
          "Demonstrativo detalhado de receitas, taxa administrativa, custos de terceiros e estornos da plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contabil,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  descricao: string;
  competencia: string;
  corrida_id: string | null;
  pagamento_id: string | null;
  detalhamento: Record<string, unknown> | null;
  created_at: string;
}

interface Custo {
  id: string;
  fornecedor: string;
  categoria: string;
  descricao: string;
  valor: number;
  competencia: string;
  recorrente: boolean;
}

interface Estorno {
  id: string;
  pagamento_id: string;
  valor: number;
  integral: boolean;
  devolve_taxa: boolean;
  motivo: string;
  status: string;
  provedor: string | null;
  provedor_ref: string | null;
  created_at: string;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

function Contabil() {
  const { user, carregando } = useAuth();
  const qc = useQueryClient();
  const [estornando, setEstornando] = useState<Pagamento | null>(null);
  const [novoCusto, setNovoCusto] = useState(false);

  const ehAdmin = useQuery({
    queryKey: ["ehAdmin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      if (error) throw error;
      return !!data;
    },
  });
  const autorizado = ehAdmin.data === true;

  const config = useQuery({
    queryKey: ["config-taxa"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plataforma_config")
        .select("*")
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as (ConfigTaxa & { id: string }) | null;
    },
  });

  const lancamentos = useQuery({
    queryKey: ["lancamentos"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_contabeis")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Lancamento[];
    },
  });

  const custos = useQuery({
    queryKey: ["custos"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custos_terceiros")
        .select("*")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Custo[];
    },
  });

  const pagamentos = useQuery({
    queryKey: ["contabil-pagamentos"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*")
        .order("pago_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Pagamento[];
    },
  });

  const corridas = useQuery({
    queryKey: ["contabil-corridas"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase.from("corridas").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as Corrida[];
    },
  });

  const estornos = useQuery({
    queryKey: ["estornos"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estornos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Estorno[];
    },
  });

  const cfg = config.data ?? CONFIG_PADRAO;

  const salvarConfig = useMutation({
    mutationFn: async (valores: {
      taxa_percentual: number;
      taxa_fixa: number;
      repasse_motorista_percentual: number;
    }) => {
      if (config.data?.id) {
        const { error } = await supabase
          .from("plataforma_config")
          .update({ ...valores, updated_at: new Date().toISOString() })
          .eq("id", config.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plataforma_config").insert({
          chave: "padrao",
          descricao: "Taxa administrativa vigente da plataforma",
          ...valores,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Taxa administrativa atualizada.");
      qc.invalidateQueries({ queryKey: ["config-taxa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totais = useMemo(() => {
    const acc = {
      receita: 0,
      taxaPlataforma: 0,
      taxaGateway: 0,
      repasse: 0,
      estorno: 0,
      custos: 0,
    };
    for (const l of lancamentos.data ?? []) {
      const v = n(l.valor);
      if (l.tipo === "receita_bruta") acc.receita += v;
      if (l.tipo === "taxa_plataforma") acc.taxaPlataforma += v;
      if (l.tipo === "taxa_gateway") acc.taxaGateway += v;
      if (l.tipo === "repasse_motorista") acc.repasse += v;
      if (l.tipo === "estorno") acc.estorno += v;
      if (l.tipo === "custo_terceiro") acc.custos += v;
    }
    const custosLancados = (custos.data ?? []).reduce((a, c) => a + n(c.valor), 0);
    const custosTotais = Math.max(acc.custos, custosLancados);
    const resultado = acc.taxaPlataforma - acc.taxaGateway - custosTotais - acc.estorno * 0;
    return { ...acc, custosTotais, resultado };
  }, [lancamentos.data, custos.data]);

  const nomeCorrida = (id: string | null) => {
    const c = (corridas.data ?? []).find((x) => x.id === id);
    return c ? `${c.origem || "—"} → ${c.destino || "—"}` : "—";
  };

  const estornosPor = (pagamentoId: string) =>
    (estornos.data ?? []).filter((e) => e.pagamento_id === pagamentoId);

  if (carregando || ehAdmin.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-24 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando módulo contábil…
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-3xl px-5 py-24 text-center">
          <ShieldCheck className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Área restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O controle contábil é exclusivo do administrador master.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Calculator className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Controle contábil</h1>
            <p className="text-sm text-muted-foreground">
              Taxa administrativa, custos de terceiros, estornos e resultado da plataforma.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Receita bruta recebida", totais.receita],
            ["Taxa administrativa arrecadada", totais.taxaPlataforma],
            ["Tarifas do gateway", totais.taxaGateway],
            ["Repasses aos motoristas", totais.repasse],
            ["Estornos devolvidos", totais.estorno],
            ["Custos de terceiros", totais.custosTotais],
          ].map(([r, v]) => (
            <div key={r as string} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">{r}</p>
              <p className="mt-1 font-display text-xl font-bold">{brl(v as number)}</p>
            </div>
          ))}
        </section>

        <section className="mt-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold text-muted-foreground">
            Resultado da plataforma (taxa administrativa − tarifas do gateway − custos de terceiros)
          </p>
          <p
            className={`mt-1 font-display text-3xl font-bold ${
              totais.resultado >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {brl(totais.resultado)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A taxa administrativa é o que garante a contratação automatizada dos serviços de
            terceiros necessários à manutenção da plataforma. Cada centavo aparece detalhado nos
            lançamentos abaixo.
          </p>
        </section>

        <ConfigTaxaForm
          cfg={cfg}
          salvando={salvarConfig.isPending}
          onSalvar={(v) => salvarConfig.mutate(v)}
        />

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <BadgeDollarSign className="size-4" /> Custos de terceiros
            </h2>
            <button
              onClick={() => setNovoCusto(true)}
              className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="size-4" /> Lançar custo
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Fornecedor</th>
                  <th className="py-2">Categoria</th>
                  <th className="py-2">Descrição</th>
                  <th className="py-2">Competência</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(custos.data ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-border/70">
                    <td className="py-3 font-medium">{c.fornecedor}</td>
                    <td className="py-3 text-muted-foreground">{rotuloCategoria(c.categoria)}</td>
                    <td className="py-3 text-muted-foreground">
                      {c.descricao || "—"}
                      {c.recorrente && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                          recorrente
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(`${c.competencia}T00:00:00`).toLocaleDateString("pt-BR", {
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 text-right font-semibold">{brl(n(c.valor))}</td>
                  </tr>
                ))}
                {(custos.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum custo de terceiros lançado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <RotateCcw className="size-4" /> Estornos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Devolva à origem do pagamento o valor integral ou uma parte dele. Pagamentos online
            voltam pelo mesmo meio (Pix ou cartão); pagamentos em espécie ficam registrados como
            devolução manual.
          </p>
          <div className="mt-4 space-y-2">
            {(pagamentos.data ?? []).map((p) => {
              const feitos = estornosPor(p.id);
              const devolvido = feitos
                .filter((e) => e.status === "concluido")
                .reduce((a, e) => a + n(e.valor), 0);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{nomeCorrida(p.corrida_id)}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.forma}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.status}</span>
                  <span className="text-muted-foreground">
                    {new Date(p.pago_em).toLocaleDateString("pt-BR")}
                  </span>
                  {devolvido > 0 && (
                    <span className="text-destructive">devolvido {brl(devolvido)}</span>
                  )}
                  <span className="ml-auto font-bold">{brl(n(p.valor))}</span>
                  <button
                    onClick={() => setEstornando(p)}
                    disabled={p.status === "estornado"}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    Estornar
                  </button>
                </div>
              );
            })}
            {(pagamentos.data ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Lançamentos contábeis</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Data</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Descrição</th>
                  <th className="py-2">Corrida</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(lancamentos.data ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-border/70 align-top">
                    <td className="py-3 text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                        {rotuloTipo(l.tipo)}
                      </span>
                    </td>
                    <td className="py-3">
                      {l.descricao}
                      {l.detalhamento && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Object.entries(l.detalhamento)
                            .filter(([, v]) => v !== null && v !== undefined && v !== "")
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                            .join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">{nomeCorrida(l.corrida_id)}</td>
                    <td
                      className={`py-3 text-right font-semibold ${
                        sinalTipo(l.tipo) < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {sinalTipo(l.tipo) < 0 ? "- " : ""}
                      {brl(n(l.valor))}
                    </td>
                  </tr>
                ))}
                {(lancamentos.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum lançamento contábil ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {novoCusto && (
        <FormularioCusto
          onFechar={() => setNovoCusto(false)}
          onSalvo={() => {
            setNovoCusto(false);
            qc.invalidateQueries({ queryKey: ["custos"] });
          }}
        />
      )}

      {estornando && (
        <FormularioEstorno
          pagamento={estornando}
          cfg={cfg}
          onFechar={() => setEstornando(null)}
          onSalvo={() => {
            setEstornando(null);
            qc.invalidateQueries({ queryKey: ["estornos"] });
            qc.invalidateQueries({ queryKey: ["lancamentos"] });
            qc.invalidateQueries({ queryKey: ["contabil-pagamentos"] });
          }}
        />
      )}
    </div>
  );
}

function ConfigTaxaForm({
  cfg,
  salvando,
  onSalvar,
}: {
  cfg: ConfigTaxa;
  salvando: boolean;
  onSalvar: (v: {
    taxa_percentual: number;
    taxa_fixa: number;
    repasse_motorista_percentual: number;
  }) => void;
}) {
  const [f, setF] = useState({
    taxa_percentual: cfg.taxa_percentual,
    taxa_fixa: cfg.taxa_fixa,
    repasse_motorista_percentual: cfg.repasse_motorista_percentual,
  });
  const exemplo = comporCobranca(100, { ...cfg, ...f });

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Sliders className="size-4" /> Taxa administrativa vigente
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className={rotulo}>Percentual sobre a corrida (%)</label>
          <input
            type="number"
            step="0.01"
            className={campo}
            value={f.taxa_percentual}
            onChange={(e) => setF({ ...f, taxa_percentual: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={rotulo}>Valor fixo por transação (R$)</label>
          <input
            type="number"
            step="0.01"
            className={campo}
            value={f.taxa_fixa}
            onChange={(e) => setF({ ...f, taxa_fixa: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className={rotulo}>Repasse ao motorista (%)</label>
          <input
            type="number"
            step="0.01"
            className={campo}
            value={f.repasse_motorista_percentual}
            onChange={(e) =>
              setF({ ...f, repasse_motorista_percentual: Number(e.target.value) })
            }
          />
        </div>
      </div>
      <ul className="mt-4 space-y-1 rounded-xl bg-secondary/60 p-4 text-sm">
        <li className="text-xs font-semibold uppercase text-muted-foreground">
          Simulação para uma corrida de R$ 100,00
        </li>
        {exemplo.itens.map((i) => (
          <li key={i.rotulo} className="flex justify-between">
            <span className="text-muted-foreground">{i.rotulo}</span>
            <span className="font-semibold">{brl(i.valor)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-border pt-1">
          <span className="text-muted-foreground">Repasse ao motorista</span>
          <span className="font-semibold">{brl(exemplo.repasseMotorista)}</span>
        </li>
      </ul>
      <button
        onClick={() => onSalvar(f)}
        disabled={salvando}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {salvando && <Loader2 className="size-4 animate-spin" />} Salvar taxa
      </button>
    </section>
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
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold">{titulo}</h2>
          <button onClick={onFechar} className="ml-auto rounded-full border border-border p-2">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormularioCusto({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    fornecedor: "",
    categoria: "gateway",
    descricao: "",
    valor: 0,
    competencia: `${new Date().toISOString().slice(0, 7)}-01`,
    recorrente: true,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("custos_terceiros").insert({
        fornecedor: f.fornecedor,
        categoria: f.categoria,
        descricao: f.descricao,
        valor: Number(f.valor) || 0,
        competencia: f.competencia,
        recorrente: f.recorrente,
      });
      if (error) throw error;
      const { error: erroLanc } = await supabase.from("lancamentos_contabeis").insert({
        tipo: "custo_terceiro",
        valor: Number(f.valor) || 0,
        descricao: `${f.fornecedor} — ${f.descricao || rotuloCategoria(f.categoria)}`,
        competencia: f.competencia,
        detalhamento: { categoria: f.categoria, recorrente: f.recorrente, fornecedor: f.fornecedor },
      });
      if (erroLanc) throw erroLanc;
    },
    onSuccess: () => {
      toast.success("Custo de terceiros lançado.");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Lançar custo de terceiros" onFechar={onFechar}>
      <div className="mt-5 grid gap-4">
        <div>
          <label className={rotulo}>Fornecedor</label>
          <input
            className={campo}
            value={f.fornecedor}
            onChange={(e) => setF({ ...f, fornecedor: e.target.value })}
            placeholder="Ex.: provedor de SMS"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={rotulo}>Categoria</label>
            <select
              className={campo}
              value={f.categoria}
              onChange={(e) => setF({ ...f, categoria: e.target.value })}
            >
              {CATEGORIAS_CUSTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo}>Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              className={campo}
              value={f.valor}
              onChange={(e) => setF({ ...f, valor: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <label className={rotulo}>Descrição</label>
          <input
            className={campo}
            value={f.descricao}
            onChange={(e) => setF({ ...f, descricao: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={rotulo}>Competência</label>
            <input
              type="date"
              className={campo}
              value={f.competencia}
              onChange={(e) => setF({ ...f, competencia: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={f.recorrente}
              onChange={(e) => setF({ ...f, recorrente: e.target.checked })}
            />
            Custo recorrente
          </label>
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || !f.fornecedor}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Lançar custo
        </button>
      </div>
    </Modal>
  );
}

function FormularioEstorno({
  pagamento,
  cfg,
  onFechar,
  onSalvo,
}: {
  pagamento: Pagamento;
  cfg: ConfigTaxa;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const composicao = comporCobranca(n(pagamento.valor), cfg);
  const [devolveTaxa, setDevolveTaxa] = useState(false);
  const maximo = devolveTaxa ? composicao.total : composicao.base;
  const [valor, setValor] = useState(maximo);
  const [motivo, setMotivo] = useState("");

  const enviar = useMutation({
    mutationFn: async () => {
      const r = await estornarPagamento({
        data: {
          pagamentoId: pagamento.id,
          valor: Number(valor),
          motivo,
          devolveTaxa,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        r.integral
          ? `Estorno integral de ${brl(r.valor)} processado.`
          : `Estorno parcial de ${brl(r.valor)} processado.`,
      );
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal titulo="Estornar pagamento" onFechar={onFechar}>
      <div className="mt-5 grid gap-4">
        <div className="rounded-xl bg-secondary/60 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Serviço de transporte</span>
            <span className="font-semibold">{brl(composicao.base)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa administrativa</span>
            <span className="font-semibold">{brl(composicao.taxaAdministrativa)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1">
            <span className="text-muted-foreground">Total pago</span>
            <span className="font-bold">{brl(composicao.total)}</span>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={devolveTaxa}
            onChange={(e) => {
              setDevolveTaxa(e.target.checked);
              setValor(e.target.checked ? composicao.total : composicao.base);
            }}
          />
          <span>
            Devolver também a taxa administrativa
            <span className="block text-xs text-muted-foreground">
              Sem esta opção, a taxa permanece na plataforma para cobrir os serviços de terceiros já
              contratados na transação.
            </span>
          </span>
        </label>

        <div>
          <label className={rotulo}>Valor a estornar (máximo {brl(maximo)})</label>
          <input
            type="number"
            step="0.01"
            max={maximo}
            className={campo}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setValor(maximo)}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              Integral
            </button>
            <button
              type="button"
              onClick={() => setValor(Math.round(maximo * 50) / 100)}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
            >
              50%
            </button>
          </div>
        </div>

        <div>
          <label className={rotulo}>Motivo do estorno</label>
          <textarea
            rows={3}
            className={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: corrida cancelada pelo motorista antes do embarque"
          />
        </div>

        <button
          onClick={() => enviar.mutate()}
          disabled={enviar.isPending || motivo.trim().length < 5 || !(Number(valor) > 0)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {enviar.isPending && <Loader2 className="size-4 animate-spin" />} Processar estorno
        </button>
      </div>
    </Modal>
  );
}
