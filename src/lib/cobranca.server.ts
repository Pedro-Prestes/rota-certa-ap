import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, type StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import { CONFIG_PADRAO, comporCobranca, type ConfigTaxa } from "./taxas";

const n = (v: unknown) => Number(v ?? 0) || 0;
const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

export async function carregarConfig(): Promise<ConfigTaxa> {
  const { data } = await supabaseAdmin
    .from("plataforma_config")
    .select("chave, taxa_percentual, taxa_fixa, repasse_motorista_percentual, descricao")
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return {
    chave: data.chave,
    taxa_percentual: n(data.taxa_percentual),
    taxa_fixa: n(data.taxa_fixa),
    repasse_motorista_percentual: n(data.repasse_motorista_percentual),
    descricao: data.descricao ?? undefined,
  };
}

/** Saldo aberto da corrida (total dos serviços menos o que já foi recebido). */
export async function saldoAberto(corridaId: string) {
  const { data: corrida, error } = await supabaseAdmin
    .from("corridas")
    .select("*")
    .eq("id", corridaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!corrida) throw new Error("Corrida não encontrada.");

  const { data: pagos } = await supabaseAdmin
    .from("pagamentos")
    .select("valor, status")
    .eq("corrida_id", corridaId);

  const bruto =
    n(corrida.valor_tarifa) + n(corrida.valor_bagagem) + n(corrida.valor_pedagios) + n(corrida.valor_extras);
  const total = Math.max(0, bruto - n(corrida.desconto));
  const recebido = (pagos ?? [])
    .filter((p) => p.status === "pago")
    .reduce((a, p) => a + n(p.valor), 0);

  return { corrida, total: arred(total), recebido: arred(recebido), aberto: arred(Math.max(0, total - recebido)) };
}

async function resolverCliente(
  stripe: Stripe,
  options: { email?: string | undefined; userId?: string | undefined },
): Promise<string | undefined> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Identificador de usuário inválido.");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const cliente = existing.data[0];
    if (cliente) {
      if (options.userId && cliente.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(cliente.id, {
          metadata: { ...cliente.metadata, userId: options.userId },
        });
      }
      return cliente.id;
    }
  }
  if (!options.email && !options.userId) return undefined;
  const criado = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return criado.id;
}

export interface EntradaCheckout {
  corridaId: string;
  userId: string;
  email?: string | undefined;
  returnUrl: string;
  environment: StripeEnv;
  valorBase?: number | undefined;
}

/**
 * Cria a sessão de checkout embutida. O valor cobrado é a base em aberto da
 * corrida somada à taxa administrativa vigente.
 */
export async function criarCheckoutCorrida(dados: EntradaCheckout) {
  const { corrida, aberto } = await saldoAberto(dados.corridaId);
  if (corrida.user_id !== dados.userId) {
    const { data: admin } = await supabaseAdmin.rpc("has_role", {
      _user_id: dados.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Você não tem permissão para cobrar esta corrida.");
  }

  const baseTotal = arred(dados.valorBase && dados.valorBase > 0 ? dados.valorBase : aberto);
  if (baseTotal < 1) throw new Error("Não há saldo em aberto para cobrar nesta corrida.");

  // Créditos pré-pagos abatem a base, sempre deixando ao menos R$ 1 a cobrar.
  const { saldo } = await carteiraDoUsuario(corrida.user_id, dados.environment);
  const creditoUsado = arred(Math.max(0, Math.min(saldo, baseTotal - 1)));
  const base = arred(baseTotal - creditoUsado);

  const cfg = await configDoUsuario(corrida.user_id, dados.environment);
  const composicao = comporCobranca(base, cfg);


  const stripe = createStripeClient(dados.environment);
  const customer = await resolverCliente(stripe, { email: dados.email, userId: dados.userId });
  const descricao = `Corrida ${corrida.origem || "origem"} → ${corrida.destino || "destino"}`;

  const payload: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    ui_mode: "embedded_page",
    return_url: dados.returnUrl,
    ...(customer && { customer }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: composicao.totalCentavos,
          product_data: {
            name: descricao,
            description: `Serviço de transporte R$ ${composicao.base.toFixed(2)} + taxa administrativa R$ ${composicao.taxaAdministrativa.toFixed(2)}`,
          },
        },
      },
    ],
    payment_intent_data: {
      description: descricao,
      metadata: { corridaId: corrida.id, userId: corrida.user_id },
    },
    metadata: {
      corridaId: corrida.id,
      userId: corrida.user_id,
      baseCentavos: String(Math.round(composicao.base * 100)),
      taxaCentavos: String(Math.round(composicao.taxaAdministrativa * 100)),
      repasseCentavos: String(Math.round(composicao.repasseMotorista * 100)),
    },
  };

  let session: Stripe.Checkout.Session;
  try {
    // Pix + cartões de crédito e débito de todas as bandeiras habilitadas.
    session = await stripe.checkout.sessions.create({
      ...payload,
      payment_method_types: ["card", "pix"],
    });
  } catch {
    session = await stripe.checkout.sessions.create({ ...payload, payment_method_types: ["card"] });
  }

  await registrarEvento({
    evento: "cobranca_iniciada",
    corridaId: corrida.id,
    registradoPor: dados.userId,
    dados: {
      sessao: session.id,
      base: composicao.base,
      taxa_administrativa: composicao.taxaAdministrativa,
      total: composicao.total,
      ambiente: dados.environment,
    },
  });

  return { clientSecret: session.client_secret ?? "", composicao };
}

function formaDoCharge(charge: Stripe.Charge | null): "pix" | "credito" | "debito" {
  const detalhes = charge?.payment_method_details;
  if (detalhes?.type === "pix") return "pix";
  const funding = detalhes?.card?.funding;
  return funding === "debit" ? "debito" : "credito";
}

/** Grava pagamento, lançamentos contábeis e bloco de auditoria após a confirmação. */
export async function confirmarPagamentoSessao(session: any, env: StripeEnv) {
  const corridaId = session?.metadata?.corridaId as string | undefined;
  const userId = session?.metadata?.userId as string | undefined;
  if (!corridaId || !userId) {
    console.error("Sessão sem metadados de corrida.");
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  const { data: existente } = await supabaseAdmin
    .from("pagamentos")
    .select("id")
    .eq("autorizacao", paymentIntentId ?? session.id)
    .maybeSingle();
  if (existente) return;

  const stripe = createStripeClient(env);
  let charge: Stripe.Charge | null = null;
  let taxaGateway = 0;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const latest = pi.latest_charge;
    charge = latest && typeof latest !== "string" ? latest : null;
    const bt = charge?.balance_transaction;
    if (bt && typeof bt !== "string") taxaGateway = arred(bt.fee / 100);
  }

  const base = arred(Number(session.metadata?.baseCentavos ?? 0) / 100);
  const taxaAdministrativa = arred(Number(session.metadata?.taxaCentavos ?? 0) / 100);
  const repasse = arred(Number(session.metadata?.repasseCentavos ?? 0) / 100);
  const total = arred(Number(session.amount_total ?? 0) / 100);
  const forma = formaDoCharge(charge);
  const bandeira = charge?.payment_method_details?.card?.brand ?? (forma === "pix" ? "Pix" : null);

  const { data: pagamento, error } = await supabaseAdmin
    .from("pagamentos")
    .insert({
      corrida_id: corridaId,
      user_id: userId,
      forma,
      status: "pago",
      valor: base,
      taxa_percentual: 0,
      parcelas: 1,
      bandeira,
      autorizacao: paymentIntentId ?? session.id,
      pago_em: new Date().toISOString(),
      observacoes: `Cobrança online (${env}). Total pago R$ ${total.toFixed(2)} — inclui taxa administrativa de R$ ${taxaAdministrativa.toFixed(2)}.`,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Falha ao gravar pagamento:", error.message);
    return;
  }

  const comp = competencia();
  const lancamentos = [
    {
      tipo: "receita_bruta" as const,
      valor: total,
      descricao: "Recebimento de corrida (serviço + taxa administrativa)",
    },
    {
      tipo: "taxa_plataforma" as const,
      valor: taxaAdministrativa,
      descricao: "Taxa administrativa destinada à manutenção automatizada da plataforma",
    },
    { tipo: "taxa_gateway" as const, valor: taxaGateway, descricao: "Tarifa do gateway de pagamento" },
    { tipo: "repasse_motorista" as const, valor: repasse, descricao: "Repasse devido ao motorista" },
  ].filter((l) => l.valor > 0);

  await supabaseAdmin.from("lancamentos_contabeis").insert(
    lancamentos.map((l) => ({
      tipo: l.tipo,
      valor: l.valor,
      descricao: l.descricao,
      competencia: comp,
      corrida_id: corridaId,
      pagamento_id: pagamento.id,
      detalhamento: {
        forma,
        bandeira,
        base,
        taxa_administrativa: taxaAdministrativa,
        taxa_gateway: taxaGateway,
        total,
        ambiente: env,
        sessao: session.id,
      },
    })),
  );

  await registrarEvento({
    evento: "pagamento_confirmado",
    corridaId,
    registradoPor: userId,
    dados: {
      pagamento: pagamento.id,
      forma,
      bandeira,
      base,
      taxa_administrativa: taxaAdministrativa,
      taxa_gateway: taxaGateway,
      total,
      ambiente: env,
    },
  });
}

export interface EntradaEstorno {
  pagamentoId: string;
  valor: number;
  motivo: string;
  devolveTaxa: boolean;
  adminId: string;
  environment: StripeEnv;
}

/** Estorno integral ou parcial devolvido à origem do pagamento. */
export async function processarEstorno(dados: EntradaEstorno) {
  const { data: pagamento, error } = await supabaseAdmin
    .from("pagamentos")
    .select("*")
    .eq("id", dados.pagamentoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pagamento) throw new Error("Pagamento não encontrado.");
  if (pagamento.status === "estornado") throw new Error("Este pagamento já foi estornado.");

  const { data: anteriores } = await supabaseAdmin
    .from("estornos")
    .select("valor, status")
    .eq("pagamento_id", dados.pagamentoId);
  const jaEstornado = (anteriores ?? [])
    .filter((e) => e.status === "concluido" || e.status === "processando")
    .reduce((a, e) => a + n(e.valor), 0);

  const cfg = await carregarConfig();
  const composicao = comporCobranca(n(pagamento.valor), cfg);
  const maximo = arred(
    (dados.devolveTaxa ? composicao.total : composicao.base) - jaEstornado,
  );
  const valor = arred(Math.min(Math.max(0, dados.valor), maximo));
  if (valor <= 0) throw new Error("Valor de estorno indisponível para este pagamento.");
  const integral = valor >= maximo - 0.004 && jaEstornado === 0;

  const { data: estorno, error: erroEstorno } = await supabaseAdmin
    .from("estornos")
    .insert({
      pagamento_id: pagamento.id,
      corrida_id: pagamento.corrida_id,
      valor,
      integral,
      devolve_taxa: dados.devolveTaxa,
      motivo: dados.motivo,
      autorizado_por: dados.adminId,
      status: "processando",
      provedor: pagamento.forma === "dinheiro" ? "manual" : "stripe",
    })
    .select("id")
    .single();
  if (erroEstorno) throw new Error(erroEstorno.message);

  let referencia: string | null = null;
  const online = pagamento.forma !== "dinheiro" && !!pagamento.autorizacao?.startsWith("pi_");

  if (online) {
    try {
      const stripe = createStripeClient(dados.environment);
      const refund = await stripe.refunds.create({
        payment_intent: pagamento.autorizacao as string,
        amount: Math.round(valor * 100),
        metadata: { estornoId: estorno.id, motivo: dados.motivo.slice(0, 200) },
      });
      referencia = refund.id;
    } catch (e) {
      await supabaseAdmin
        .from("estornos")
        .update({ status: "falhou", updated_at: new Date().toISOString() })
        .eq("id", estorno.id);
      throw e;
    }
  }

  await supabaseAdmin
    .from("estornos")
    .update({
      status: "concluido",
      processado_em: new Date().toISOString(),
      provedor_ref: referencia,
      updated_at: new Date().toISOString(),
    })
    .eq("id", estorno.id);

  if (integral) {
    await supabaseAdmin
      .from("pagamentos")
      .update({ status: "estornado", updated_at: new Date().toISOString() })
      .eq("id", pagamento.id);
  }

  await supabaseAdmin.from("lancamentos_contabeis").insert({
    tipo: "estorno",
    valor,
    descricao: integral ? "Estorno integral à origem" : "Estorno parcial à origem",
    competencia: competencia(),
    corrida_id: pagamento.corrida_id,
    pagamento_id: pagamento.id,
    estorno_id: estorno.id,
    detalhamento: {
      integral,
      devolve_taxa: dados.devolveTaxa,
      forma_origem: pagamento.forma,
      provedor: online ? "stripe" : "manual",
      provedor_ref: referencia,
      motivo: dados.motivo,
      ambiente: dados.environment,
    },
  });

  await registrarEvento({
    evento: "estorno_processado",
    corridaId: pagamento.corrida_id,
    registradoPor: dados.adminId,
    dados: {
      estorno: estorno.id,
      pagamento: pagamento.id,
      valor,
      integral,
      devolve_taxa: dados.devolveTaxa,
      provedor_ref: referencia,
      motivo: dados.motivo,
    },
  });

  return { estornoId: estorno.id, valor, integral, referencia, online };
}
