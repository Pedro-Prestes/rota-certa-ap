/**
 * Modo simulação (somente ambiente de teste).
 *
 * Permite exercitar de ponta a ponta os fluxos de compra de créditos,
 * assinatura de plano e pagamento de corrida sem depender do provedor de
 * pagamento — reaproveitando exatamente as mesmas rotinas de cumprimento
 * usadas pelo webhook real.
 *
 * Nada aqui funciona em produção: toda função exige environment === "sandbox".
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import { comporCobranca } from "./taxas";
import {
  carteiraDoUsuario,
  creditarCompraCreditos,
  encerrarAssinatura,
  registrarAssinatura,
  registrarFaturaAssinatura,
} from "./assinatura.server";
import { configDoUsuario, saldoAberto } from "./cobranca.server";
import { pacotePorId, planoDoPrice, precoPorId } from "./planos";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;
const id = (prefixo: string) => `${prefixo}_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;

/** Bloqueia qualquer simulação fora do ambiente de teste. */
function exigirSandbox(env: StripeEnv) {
  if (env !== "sandbox") {
    throw new Error("A simulação só está disponível no ambiente de teste.");
  }
}

export type FormaSimulada = "pix" | "credito" | "debito";

/* ------------------------------------------------------------------ */
/* Compra de créditos                                                  */
/* ------------------------------------------------------------------ */

export async function simularCompraCreditos(dados: {
  userId: string;
  priceId: string;
  forma: FormaSimulada;
  env: StripeEnv;
}) {
  exigirSandbox(dados.env);
  const pacote = pacotePorId(dados.priceId);
  if (!pacote) throw new Error("Pacote de créditos inválido.");

  const sessao = {
    id: id("cs"),
    amount_total: Math.round(pacote.valor * 100),
    payment_status: "paid",
    metadata: {
      userId: dados.userId,
      priceId: dados.priceId,
      tipo: "creditos",
      simulado: "1",
      forma: dados.forma,
    },
  };

  await creditarCompraCreditos(sessao, dados.env);
  const { saldo } = await carteiraDoUsuario(dados.userId, dados.env);
  return { sessao: sessao.id, creditado: pacote.valor + pacote.bonus, saldo };
}

/* ------------------------------------------------------------------ */
/* Assinatura pelo provedor                                            */
/* ------------------------------------------------------------------ */

export async function simularAssinatura(dados: {
  userId: string;
  priceId: string;
  env: StripeEnv;
}) {
  exigirSandbox(dados.env);
  const preco = precoPorId(dados.priceId);
  const plano = planoDoPrice(dados.priceId);
  if (!preco || !plano) throw new Error("Plano inválido.");

  const inicio = Math.floor(Date.now() / 1000);
  const dias = preco.periodicidade === "anual" ? 365 : 30;
  const fim = inicio + dias * 86400;
  const assinaturaId = id("sub");

  const subscription = {
    id: assinaturaId,
    customer: `cus_sim_${dados.userId.slice(0, 12)}`,
    status: "active",
    cancel_at_period_end: false,
    current_period_start: inicio,
    current_period_end: fim,
    metadata: { userId: dados.userId, priceId: dados.priceId, simulado: "1" },
    items: {
      data: [
        {
          current_period_start: inicio,
          current_period_end: fim,
          quantity: 1,
          price: {
            id: id("price"),
            lookup_key: dados.priceId,
            product: plano.productId,
          },
        },
      ],
    },
  };

  await registrarAssinatura(subscription, dados.env, true);

  await registrarFaturaAssinatura(
    {
      id: id("in"),
      subscription: assinaturaId,
      amount_paid: Math.round(preco.valor * 100),
      total: Math.round(preco.valor * 100),
      lines: { data: [{ price: { lookup_key: dados.priceId } }] },
    },
    dados.env,
  );

  return { assinatura: assinaturaId, plano: plano.nome, valor: preco.valor, fim: new Date(fim * 1000).toISOString() };
}

/** Simula a renovação (nova fatura paga) da assinatura simulada vigente. */
export async function simularRenovacaoAssinatura(dados: { userId: string; env: StripeEnv }) {
  exigirSandbox(dados.env);
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id, price_id, product_id")
    .eq("user_id", dados.userId)
    .eq("environment", dados.env)
    .like("stripe_subscription_id", "sub_sim_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) throw new Error("Nenhuma assinatura simulada encontrada.");
  const preco = precoPorId(sub.price_id);
  if (!preco) throw new Error("Plano da assinatura simulada não reconhecido.");

  const inicio = Math.floor(Date.now() / 1000);
  const dias = preco.periodicidade === "anual" ? 365 : 30;
  const fim = inicio + dias * 86400;

  await registrarAssinatura(
    {
      id: sub.stripe_subscription_id,
      customer: `cus_sim_${dados.userId.slice(0, 12)}`,
      status: "active",
      cancel_at_period_end: false,
      metadata: { userId: dados.userId, priceId: sub.price_id, simulado: "1" },
      items: {
        data: [
          {
            current_period_start: inicio,
            current_period_end: fim,
            quantity: 1,
            price: { id: id("price"), lookup_key: sub.price_id, product: sub.product_id },
          },
        ],
      },
    },
    dados.env,
    false,
  );

  await registrarFaturaAssinatura(
    {
      id: id("in"),
      subscription: sub.stripe_subscription_id,
      amount_paid: Math.round(preco.valor * 100),
      total: Math.round(preco.valor * 100),
      lines: { data: [{ price: { lookup_key: sub.price_id } }] },
    },
    dados.env,
  );

  return { assinatura: sub.stripe_subscription_id, fim: new Date(fim * 1000).toISOString() };
}

/** Encerra a assinatura simulada (equivale ao evento de cancelamento). */
export async function simularCancelamentoAssinatura(dados: { userId: string; env: StripeEnv }) {
  exigirSandbox(dados.env);
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", dados.userId)
    .eq("environment", dados.env)
    .like("stripe_subscription_id", "sub_sim_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) throw new Error("Nenhuma assinatura simulada encontrada.");
  await encerrarAssinatura({ id: sub.stripe_subscription_id }, dados.env);
  return { assinatura: sub.stripe_subscription_id };
}

/* ------------------------------------------------------------------ */
/* Pagamento de corrida                                                */
/* ------------------------------------------------------------------ */

/** Corridas do usuário com saldo em aberto, para escolher na simulação. */
export async function corridasSimulaveis(userId: string) {
  const { data: corridas } = await supabaseAdmin
    .from("corridas")
    .select("id, origem, destino, data_corrida, valor_tarifa")
    .eq("user_id", userId)
    .order("data_corrida", { ascending: false })
    .limit(15);

  const lista = await Promise.all(
    (corridas ?? []).map(async (c) => {
      const { aberto } = await saldoAberto(c.id);
      return { ...c, aberto };
    }),
  );
  return lista.filter((c) => c.aberto >= 1);
}

/** Grava um pagamento simulado com a mesma contabilidade do fluxo real. */
export async function simularPagamentoCorrida(dados: {
  corridaId: string;
  userId: string;
  forma: FormaSimulada;
  usarCreditos: boolean;
  env: StripeEnv;
}) {
  exigirSandbox(dados.env);
  const { corrida, aberto } = await saldoAberto(dados.corridaId);
  if (aberto < 1) throw new Error("Esta corrida não tem saldo em aberto.");

  const dono = corrida.user_id as string;
  const { saldo } = await carteiraDoUsuario(dono, dados.env);
  const creditoUsado = dados.usarCreditos ? arred(Math.max(0, Math.min(saldo, aberto - 1))) : 0;
  const base = arred(aberto - creditoUsado);

  const cfg = await configDoUsuario(dono, dados.env);
  const composicao = comporCobranca(base, cfg);
  const taxaGateway =
    dados.forma === "pix" ? arred(composicao.total * 0.0099) : arred(composicao.total * 0.0349 + 0.39);
  const autorizacao = id("pi");

  const { data: pagamento, error } = await supabaseAdmin
    .from("pagamentos")
    .insert({
      corrida_id: dados.corridaId,
      user_id: dono,
      forma: dados.forma,
      status: "pago",
      valor: composicao.base,
      taxa_percentual: 0,
      parcelas: 1,
      bandeira: dados.forma === "pix" ? "Pix" : "simulada",
      autorizacao,
      pago_em: new Date().toISOString(),
      observacoes: `SIMULAÇÃO (ambiente de teste) — total R$ ${composicao.total.toFixed(2)}, taxa administrativa R$ ${composicao.taxaAdministrativa.toFixed(2)}.`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (creditoUsado > 0) {
    await supabaseAdmin.from("carteira_transacoes").insert({
      user_id: dono,
      tipo: "debito_corrida",
      valor: creditoUsado,
      descricao: "Créditos aplicados no pagamento simulado da corrida",
      corrida_id: dados.corridaId,
      pagamento_id: pagamento.id,
      referencia_externa: `${autorizacao}:debito`,
      environment: dados.env,
    });
  }

  const comp = competencia();
  const lancamentos = [
    { tipo: "receita_bruta" as const, valor: composicao.total, descricao: "Recebimento simulado de corrida" },
    {
      tipo: "taxa_plataforma" as const,
      valor: composicao.taxaAdministrativa,
      descricao: "Taxa administrativa simulada (manutenção automatizada da plataforma)",
    },
    { tipo: "taxa_gateway" as const, valor: taxaGateway, descricao: "Tarifa simulada do gateway" },
    {
      tipo: "repasse_motorista" as const,
      valor: composicao.repasseMotorista,
      descricao: "Repasse simulado devido ao motorista",
    },
  ].filter((l) => l.valor > 0);

  await supabaseAdmin.from("lancamentos_contabeis").insert(
    lancamentos.map((l) => ({
      tipo: l.tipo,
      valor: l.valor,
      descricao: l.descricao,
      competencia: comp,
      corrida_id: dados.corridaId,
      pagamento_id: pagamento.id,
      detalhamento: {
        simulado: true,
        forma: dados.forma,
        base: composicao.base,
        taxa_administrativa: composicao.taxaAdministrativa,
        taxa_gateway: taxaGateway,
        total: composicao.total,
        creditos_aplicados: creditoUsado,
        ambiente: dados.env,
        autorizacao,
      },
    })),
  );

  await registrarEvento({
    evento: "pagamento_simulado",
    corridaId: dados.corridaId,
    registradoPor: dados.userId,
    dados: {
      pagamento: pagamento.id,
      forma: dados.forma,
      total: composicao.total,
      taxa_administrativa: composicao.taxaAdministrativa,
      creditos_aplicados: creditoUsado,
      ambiente: dados.env,
    },
  });

  return {
    pagamento: pagamento.id,
    composicao,
    creditoUsado,
    taxaGateway,
  };
}

/* ------------------------------------------------------------------ */
/* Limpeza                                                             */
/* ------------------------------------------------------------------ */

/** Remove tudo que foi gerado em simulação para o usuário. */
export async function limparSimulacao(dados: { userId: string; env: StripeEnv }) {
  exigirSandbox(dados.env);

  const { data: pagamentos } = await supabaseAdmin
    .from("pagamentos")
    .select("id")
    .eq("user_id", dados.userId)
    .like("autorizacao", "pi_sim_%");
  const ids = (pagamentos ?? []).map((p) => p.id);

  if (ids.length) {
    await supabaseAdmin.from("lancamentos_contabeis").delete().in("pagamento_id", ids);
    await supabaseAdmin.from("carteira_transacoes").delete().in("pagamento_id", ids);
    await supabaseAdmin.from("pagamentos").delete().in("id", ids);
  }

  await supabaseAdmin
    .from("carteira_transacoes")
    .delete()
    .eq("user_id", dados.userId)
    .eq("environment", dados.env)
    .like("referencia_externa", "sessao:cs_sim_%");

  await supabaseAdmin
    .from("lancamentos_contabeis")
    .delete()
    .filter("detalhamento->>fatura", "like", "in_sim_%");

  await supabaseAdmin
    .from("subscriptions")
    .delete()
    .eq("user_id", dados.userId)
    .eq("environment", dados.env)
    .like("stripe_subscription_id", "sub_sim_%");

  return { pagamentosRemovidos: ids.length };
}
