import { useEffect, useState } from "react";
import { FlaskConical, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PACOTES_CREDITO, PLANOS } from "@/lib/planos";
import { getStripeEnvironment } from "@/lib/stripe";
import {
  limparDadosSimulados,
  listarCorridasSimulaveis,
  simularCancelamento,
  simularCompra,
  simularPagamento,
  simularRenovacao,
} from "@/utils/simulacao.functions";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const FORMAS = [
  { id: "pix", rotulo: "Pix" },
  { id: "credito", rotulo: "Cartão de crédito" },
  { id: "debito", rotulo: "Cartão de débito" },
] as const;

interface CorridaAberta {
  id: string;
  origem: string | null;
  destino: string | null;
  data_corrida: string | null;
  aberto: number;
}

/**
 * Painel de simulação de compras e pagamentos — visível apenas no ambiente de
 * teste. Usa as mesmas rotinas de cumprimento do fluxo real, sem tocar no
 * provedor de pagamento.
 */
export function PainelSimulacao({ onAtualizar }: { onAtualizar?: () => void | Promise<void> }) {
  const env = getStripeEnvironment();
  const [forma, setForma] = useState<(typeof FORMAS)[number]["id"]>("pix");
  const [corridas, setCorridas] = useState<CorridaAberta[]>([]);
  const [corrida, setCorrida] = useState("");
  const [usarCreditos, setUsarCreditos] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregarCorridas = async () => {
    try {
      const r = await listarCorridasSimulaveis({ data: { environment: env } });
      setCorridas((r.corridas ?? []) as CorridaAberta[]);
      setCorrida((atual) => atual || (r.corridas?.[0]?.id ?? ""));
    } catch {
      setCorridas([]);
    }
  };

  useEffect(() => {
    // Fora do sandbox o painel não é exibido e nada é consultado no servidor.
    if (env !== "sandbox") return;
    void carregarCorridas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  if (env !== "sandbox") return null;


  const executar = async (chave: string, fn: () => Promise<void>) => {
    setOcupado(chave);
    try {
      await fn();
      await onAtualizar?.();
      await carregarCorridas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A simulação não pôde ser concluída.");
    } finally {
      setOcupado(null);
    }
  };

  const comprar = (priceId: string) =>
    executar(priceId, async () => {
      const r: any = await simularCompra({ data: { priceId, forma, environment: env } });
      if (r?.error) throw new Error(r.error);
      toast.success(
        r.tipo === "creditos"
          ? `Compra simulada concluída: ${brl(r.creditado)} em créditos (saldo ${brl(r.saldo)}).`
          : `Plano ${r.plano} ativado em simulação até ${new Date(r.fim).toLocaleDateString("pt-BR")}.`,
      );
    });

  const pagar = () =>
    executar("pagar", async () => {
      if (!corrida) throw new Error("Selecione uma corrida com saldo em aberto.");
      const r: any = await simularPagamento({
        data: { corridaId: corrida, forma, usarCreditos, environment: env },
      });
      if (r?.error) throw new Error(r.error);
      toast.success(
        `Pagamento simulado de ${brl(r.composicao.total)} — taxa administrativa ${brl(
          r.composicao.taxaAdministrativa,
        )}${r.creditoUsado > 0 ? `, créditos aplicados ${brl(r.creditoUsado)}` : ""}.`,
      );
    });

  const botao =
    "rounded-full border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50";

  return (
    <section className="mt-8 rounded-2xl border border-dashed border-accent/60 bg-accent/5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent/20">
          <FlaskConical className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">Simulação de compras e pagamentos</h2>
          <p className="text-sm text-muted-foreground">
            Disponível somente no ambiente de teste. Nenhuma cobrança real é feita, mas a carteira, os
            planos, a contabilidade e a auditoria são atualizados exatamente como no fluxo verdadeiro.
          </p>
        </div>
        <button
          onClick={() =>
            executar("limpar", async () => {
              const r: any = await limparDadosSimulados({ data: { environment: env } });
              if (r?.error) throw new Error(r.error);
              toast.success("Dados de simulação removidos.");
            })
          }
          disabled={ocupado !== null}
          className={`ml-auto inline-flex items-center gap-2 ${botao}`}
        >
          {ocupado === "limpar" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Limpar simulação
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Forma simulada:</span>
        {FORMAS.map((f) => (
          <button
            key={f.id}
            onClick={() => setForma(f.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              forma === f.id ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">Pacotes de crédito</h3>
          <div className="mt-3 space-y-2">
            {PACOTES_CREDITO.map((p) => (
              <button
                key={p.priceId}
                onClick={() => comprar(p.priceId)}
                disabled={ocupado !== null}
                className={`w-full text-left ${botao}`}
              >
                {ocupado === p.priceId ? "Processando..." : `Simular ${p.rotulo}`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">Assinaturas</h3>
          <div className="mt-3 space-y-2">
            {PLANOS.flatMap((plano) =>
              plano.precos.map((preco) => (
                <button
                  key={preco.priceId}
                  onClick={() => comprar(preco.priceId)}
                  disabled={ocupado !== null}
                  className={`w-full text-left ${botao}`}
                >
                  {ocupado === preco.priceId
                    ? "Processando..."
                    : `${plano.nome} · ${preco.rotulo}`}
                </button>
              )),
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                executar("renovar", async () => {
                  const r: any = await simularRenovacao({ data: { environment: env } });
                  if (r?.error) throw new Error(r.error);
                  toast.success("Renovação simulada registrada com nova fatura paga.");
                })
              }
              disabled={ocupado !== null}
              className={`inline-flex items-center gap-2 ${botao}`}
            >
              <RefreshCw className="size-4" /> Renovar
            </button>
            <button
              onClick={() =>
                executar("cancelar", async () => {
                  const r: any = await simularCancelamento({ data: { environment: env } });
                  if (r?.error) throw new Error(r.error);
                  toast.success("Cancelamento simulado aplicado.");
                })
              }
              disabled={ocupado !== null}
              className={botao}
            >
              Cancelar
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <h3 className="font-semibold">Pagamento de corrida</h3>
          {corridas.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma corrida com saldo em aberto no seu cadastro.
            </p>
          ) : (
            <>
              <select
                value={corrida}
                onChange={(e) => setCorrida(e.target.value)}
                className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {corridas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.origem ?? "origem") + " → " + (c.destino ?? "destino")} · {brl(c.aberto)}
                  </option>
                ))}
              </select>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usarCreditos}
                  onChange={(e) => setUsarCreditos(e.target.checked)}
                />
                Abater créditos da carteira
              </label>
              <button onClick={pagar} disabled={ocupado !== null} className={`mt-3 w-full ${botao}`}>
                {ocupado === "pagar" ? "Processando..." : "Simular pagamento"}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
