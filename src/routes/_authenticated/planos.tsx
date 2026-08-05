import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { ArrowDownRight, ArrowUpRight, Check, ExternalLink, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PACOTES_CREDITO, PLANOS, assinaturaAtiva, classificarTroca, planoDoPrice } from "@/lib/planos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import {
  abrirPortalCobranca,
  alterarPlano,
  consultarCarteira,
  criarCheckoutPlano,
  encerrarPlano,
} from "@/utils/assinatura.functions";
import {
  assinarComCreditos,
  consultarAssinaturaCreditos,
  encerrarPlanoCreditos,
  trocarPlanoCreditos,
} from "@/utils/assinatura-carteira.functions";


export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos e créditos RotaCerta | Assinaturas e carteira" },
      {
        name: "description",
        content:
          "Assine o Motorista Pro ou o Clube do Passageiro para reduzir a taxa administrativa e compre créditos pré-pagos para abater suas corridas na RotaCerta.",
      },
      { property: "og:title", content: "Planos e créditos RotaCerta" },
      {
        property: "og:description",
        content:
          "Assinaturas com taxa administrativa reduzida e pacotes de créditos pré-pagos para as corridas da RotaCerta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanosPage,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

interface Assinatura {
  id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function CheckoutProduto({ priceId, onFechar }: { priceId: string; onFechar: () => void }) {
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        const resultado = await criarCheckoutPlano({
          data: {
            priceId,
            returnUrl: `${window.location.origin}/checkout-retorno?session_id={CHECKOUT_SESSION_ID}`,
            environment: getStripeEnvironment(),
          },
        });
        if ("error" in resultado) throw new Error(resultado.error);
        if (!resultado.clientSecret) throw new Error("O provedor não retornou a sessão de pagamento.");
        return resultado.clientSecret;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Finalizar contratação</h2>
            <p className="text-sm text-muted-foreground">
              Pix e cartões de crédito e débito de todas as bandeiras habilitadas.
            </p>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto rounded-full border border-border p-2"
            aria-label="Fechar pagamento"
          >
            <X className="size-4" />
          </button>
        </div>
        <div id="checkout" className="mt-5">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}

interface AssinaturaCarteira {
  id: string;
  price_id: string;
  status: string;
  valor_mensal: number;
  periodo_fim: string;
  proxima_cobranca: string;
  cancelar_no_fim: boolean;
}

function PlanosPage() {
  const { user } = useAuth();
  const env = getStripeEnvironment();
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [porCreditos, setPorCreditos] = useState<AssinaturaCarteira | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [extrato, setExtrato] = useState<any[]>([]);
  const [checkout, setCheckout] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("id, price_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAssinatura(data && assinaturaAtiva(data) ? (data as Assinatura) : null);
    const carteiraPlano = await consultarAssinaturaCreditos({ data: { environment: env } });
    setPorCreditos(
      carteiraPlano &&
        (carteiraPlano.status !== "cancelada" || carteiraPlano.cancelar_no_fim) &&
        new Date(carteiraPlano.periodo_fim).getTime() > Date.now()
        ? (carteiraPlano as unknown as AssinaturaCarteira)
        : null,
    );
    const carteira = await consultarCarteira({ data: { environment: env } });
    setSaldo(carteira.saldo);
    setExtrato(carteira.transacoes);
  };

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const planoAtual = assinatura
    ? planoDoPrice(assinatura.price_id)
    : porCreditos
      ? planoDoPrice(porCreditos.price_id)
      : undefined;

  const acao = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setOcupado(false);
    }
  };

  const trocar = (priceId: string) =>
    acao(async () => {
      const r = await alterarPlano({ data: { priceId, environment: env } });
      if ("error" in r) throw new Error(r.error);
      toast.success(
        r.tipo === "upgrade"
          ? "Upgrade aplicado agora, com a diferença proporcional cobrada na fatura."
          : "Downgrade agendado: o plano atual vale até o fim do período pago.",
      );
      await recarregar();
    });

  const cancelar = (imediato: boolean) =>
    acao(async () => {
      const r = await encerrarPlano({ data: { imediato, environment: env } });
      if ("error" in r) throw new Error(r.error);
      toast.success(
        imediato
          ? "Plano cancelado e benefícios encerrados imediatamente."
          : "Cancelamento agendado para o fim do período pago.",
      );
      await recarregar();
    });

  const assinarCreditos = (priceId: string) =>
    acao(async () => {
      const r = await assinarComCreditos({ data: { priceId, environment: env } });
      if (r && "error" in r) throw new Error(r.error);
      toast.success("Plano ativado com créditos da carteira.");
      await recarregar();
    });

  const trocarCreditos = (priceId: string) =>
    acao(async () => {
      const r = await trocarPlanoCreditos({ data: { priceId, environment: env } });
      if (r && "error" in r) throw new Error(r.error);
      toast.success("Troca agendada para a próxima renovação.");
      await recarregar();
    });

  const cancelarCreditos = (imediato: boolean) =>
    acao(async () => {
      const r = await encerrarPlanoCreditos({ data: { imediato, environment: env } });
      if (r && "error" in r) throw new Error(r.error);
      toast.success(
        imediato ? "Plano com créditos encerrado agora." : "Sem novo débito: o plano vale até o fim do período.",
      );
      await recarregar();
    });

  const portal = () =>
    acao(async () => {
      const r = await abrirPortalCobranca({
        data: { returnUrl: `${window.location.origin}/planos`, environment: env },
      });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank", "noopener,noreferrer");
    });


  return (
    <div>
      <PaymentTestModeBanner />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">Planos e créditos</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          As assinaturas reduzem a taxa administrativa cobrada em cada corrida. Os créditos pré-pagos
          entram na sua carteira e abatem automaticamente as próximas cobranças.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Saldo de créditos</p>
              <p className="font-display text-2xl font-bold">{brl(saldo)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="font-semibold">
                {planoAtual ? planoAtual.nome : "Sem assinatura (taxa padrão)"}
              </p>
              {assinatura?.current_period_end && (
                <p className="text-xs text-muted-foreground">
                  {assinatura.cancel_at_period_end ? "Acesso até " : "Renova em "}
                  {new Date(assinatura.current_period_end).toLocaleDateString("pt-BR")}
                </p>
              )}
              {!assinatura && porCreditos && (
                <p className="text-xs text-muted-foreground">
                  Pago com créditos ·{" "}
                  {porCreditos.cancelar_no_fim ? "Acesso até " : "Próximo débito em "}
                  {new Date(
                    porCreditos.cancelar_no_fim ? porCreditos.periodo_fim : porCreditos.proxima_cobranca,
                  ).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          {assinatura && (
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={portal}
                disabled={ocupado}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                <ExternalLink className="size-4" /> Faturas e meio de pagamento
              </button>
              {!assinatura.cancel_at_period_end && (
                <button
                  onClick={() => cancelar(false)}
                  disabled={ocupado}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  Cancelar no fim do período
                </button>
              )}
              <button
                onClick={() => cancelar(true)}
                disabled={ocupado}
                className="rounded-full border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                Cancelar agora
              </button>
            </div>
          )}

          {!assinatura && porCreditos && (
            <div className="mt-5 space-y-3">
              <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
                Assinatura paga com créditos: {brl(Number(porCreditos.valor_mensal))} são debitados do saldo
                a cada mês. Mantenha a carteira abastecida por Pix para não perder o benefício — após 3
                tentativas sem saldo o plano é encerrado.
              </p>
              <div className="flex flex-wrap gap-2">
                {!porCreditos.cancelar_no_fim && (
                  <button
                    onClick={() => cancelarCreditos(false)}
                    disabled={ocupado}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    Não renovar no próximo mês
                  </button>
                )}
                <button
                  onClick={() => cancelarCreditos(true)}
                  disabled={ocupado}
                  className="rounded-full border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Encerrar agora
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Assinaturas</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            {PLANOS.map((plano) => (
              <article key={plano.productId} className="rounded-2xl border border-border bg-card p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {plano.publico === "motorista" ? "Para motoristas" : "Para passageiros"}
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold">{plano.nome}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plano.descricao}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plano.beneficios.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 space-y-2">
                  {plano.precos.map((preco) => {
                    const atual =
                      assinatura?.price_id === preco.priceId || porCreditos?.price_id === preco.priceId;
                    const troca = assinatura ? classificarTroca(assinatura.price_id, preco.priceId) : null;
                    const mensal = preco.periodicidade === "mensal";
                    const saldoSuficiente = saldo + 0.001 >= preco.valor;
                    return (
                      <div
                        key={preco.priceId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold">{preco.rotulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {preco.periodicidade === "anual"
                              ? `Equivale a ${brl(preco.valorMensalEquivalente)}/mês`
                              : "Cartão recorrente ou débito mensal de créditos (Pix)"}
                          </p>
                        </div>
                        {atual ? (
                          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
                            Plano atual
                          </span>
                        ) : assinatura ? (
                          <button
                            onClick={() => trocar(preco.priceId)}
                            disabled={ocupado}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            {troca === "upgrade" ? (
                              <ArrowUpRight className="size-4" />
                            ) : (
                              <ArrowDownRight className="size-4" />
                            )}
                            {troca === "upgrade" ? "Fazer upgrade" : "Fazer downgrade"}
                          </button>
                        ) : porCreditos ? (
                          mensal ? (
                            <button
                              onClick={() => trocarCreditos(preco.priceId)}
                              disabled={ocupado}
                              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                            >
                              Trocar na renovação
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Disponível após encerrar o plano por créditos
                            </span>
                          )
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setCheckout(preco.priceId)}
                              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                            >
                              Assinar no cartão
                            </button>
                            {mensal && (
                              <button
                                onClick={() => assinarCreditos(preco.priceId)}
                                disabled={ocupado || !saldoSuficiente}
                                title={
                                  saldoSuficiente
                                    ? "Debita o valor do saldo agora e a cada mês"
                                    : "Compre créditos por Pix para usar esta opção"
                                }
                                className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
                              >
                                <Wallet className="size-4" /> Pagar com créditos (Pix)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                </div>
                {assinatura && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Upgrade vale na hora com cobrança proporcional. Downgrade passa a valer na próxima
                    renovação.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Créditos pré-pagos</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {PACOTES_CREDITO.map((p) => (
              <article key={p.priceId} className="rounded-2xl border border-border bg-card p-6">
                <p className="font-display text-2xl font-bold">{brl(p.valor)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.bonus > 0 ? `+ ${brl(p.bonus)} de bônus na carteira` : "Créditos para suas corridas"}
                </p>
                <button
                  onClick={() => setCheckout(p.priceId)}
                  className="mt-4 w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Comprar
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Extrato da carteira</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Movimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {extrato.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-muted-foreground" colSpan={3}>
                      Nenhuma movimentação registrada ainda.
                    </td>
                  </tr>
                )}
                {extrato.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">{t.descricao ?? t.tipo}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        t.tipo.startsWith("debito_") ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {t.tipo.startsWith("debito_") ? "-" : "+"}
                      {brl(Number(t.valor))}

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {checkout && (
        <CheckoutProduto
          priceId={checkout}
          onFechar={() => {
            setCheckout(null);
            void recarregar();
          }}
        />
      )}
    </div>
  );
}
