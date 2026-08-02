import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, type StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import {
  PACOTES_CREDITO,
  PLANOS,
  assinaturaAtiva,
  classificarTroca,
  pacotePorId,
  planoDoPrice,
  precoPorId,
} from "./planos";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

async function resolverCliente(
  stripe: Stripe,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Identificador de usuário inválido.");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const cliente = existing.data[0];
    if (cliente) {
      if (cliente.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(cliente.id, {
          metadata: { ...cliente.metadata, userId: options.userId },
        });
      }
      return cliente.id;
    }
  }
  const criado = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return criado.id;
}

async function resolverPreco(stripe: Stripe, priceId: string) {
  const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"] });
  const preco = prices.data[0];
  if (!preco) throw new Error("Produto não encontrado no provedor de pagamento.");
  return preco;
}

export async function assinaturaAtual(userId: string, env: StripeEnv) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Assinatura vigente com benefício liberado, ou null. */
export async function assinaturaVigente(userId: string, env: StripeEnv) {
  const sub = await assinaturaAtual(userId, env);
  if (!sub || !assinaturaAtiva(sub as any)) return null;
  return sub;
}

async function notificar(
  userId: string,
  titulo: string,
  mensagem: string,
  tipo: "info" | "sucesso" | "alerta" = "sucesso",
) {
  await supabaseAdmin.from("notificacoes").insert({ user_id: userId, titulo, mensagem, tipo });
}

/** Checkout de assinatura (plano) ou de pacote de créditos. */
export async function criarCheckoutProduto(dados: {
  priceId: string;
  userId: string;
  email?: string | undefined;
  returnUrl: string;
  environment: StripeEnv;
}) {
  const stripe = createStripeClient(dados.environment);
  const stripePrice = await resolverPreco(stripe, dados.priceId);
  const recorrente = stripePrice.type === "recurring";

  if (recorrente) {
    const atual = await assinaturaVigente(dados.userId, dados.environment);
    if (atual) {
      throw new Error(
        "Você já tem um plano ativo. Use a opção de trocar de plano para alterar a assinatura.",
      );
    }
  }

  const customer = await resolverCliente(stripe, { email: dados.email, userId: dados.userId });
  const produto = stripePrice.product;
  const nomeProduto =
    produto && typeof produto !== "string" && !("deleted" in produto && produto.deleted)
      ? produto.name
      : dados.priceId;

  const payload: Stripe.Checkout.SessionCreateParams = {
    mode: recorrente ? "subscription" : "payment",
    ui_mode: "embedded_page",
    return_url: dados.returnUrl,
    customer,
    line_items: [{ price: stripePrice.id, quantity: 1 }],
    metadata: {
      userId: dados.userId,
      priceId: dados.priceId,
      tipo: recorrente ? "assinatura" : "creditos",
    },
    ...(recorrente
      ? { subscription_data: { metadata: { userId: dados.userId, priceId: dados.priceId } } }
      : {
          payment_intent_data: {
            description: nomeProduto,
            metadata: { userId: dados.userId, priceId: dados.priceId, tipo: "creditos" },
          },
        }),
    automatic_tax: { enabled: true },
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      ...payload,
      ...(recorrente ? {} : { payment_method_types: ["card", "pix"] }),
    });
  } catch {
    session = await stripe.checkout.sessions.create(payload);
  }

  return { clientSecret: session.client_secret ?? "" };
}

/** Portal de cobrança do provedor (cartões, faturas, cancelamento). */
export async function criarPortalCobranca(dados: {
  userId: string;
  email?: string | undefined;
  returnUrl?: string | undefined;
  environment: StripeEnv;
}) {
  const stripe = createStripeClient(dados.environment);
  const sub = await assinaturaAtual(dados.userId, dados.environment);
  const customer =
    sub?.stripe_customer_id ?? (await resolverCliente(stripe, { email: dados.email, userId: dados.userId }));
  const portal = await stripe.billingPortal.sessions.create({
    customer,
    ...(dados.returnUrl && { return_url: dados.returnUrl }),
  });
  return { url: portal.url };
}

/**
 * Troca de plano:
 * - upgrade → imediato, com pró-rata cobrada/creditada pelo provedor;
 * - downgrade → agendado para a próxima renovação (o plano atual vale até lá).
 */
export async function trocarPlano(dados: {
  priceId: string;
  userId: string;
  environment: StripeEnv;
}) {
  const sub = await assinaturaVigente(dados.userId, dados.environment);
  if (!sub) throw new Error("Nenhuma assinatura ativa para trocar.");
  if (sub.price_id === dados.priceId) throw new Error("Este já é o seu plano atual.");

  const stripe = createStripeClient(dados.environment);
  const stripePrice = await resolverPreco(stripe, dados.priceId);
  const assinatura = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = assinatura.items.data[0];
  if (!item) throw new Error("Assinatura sem itens no provedor.");

  const tipo = classificarTroca(sub.price_id, dados.priceId);
  const novoPlano = planoDoPrice(dados.priceId);
  const novoPreco = precoPorId(dados.priceId);

  if (tipo === "upgrade") {
    await stripe.subscriptions.update(assinatura.id, {
      items: [{ id: item.id, price: stripePrice.id }],
      proration_behavior: "always_invoice",
      metadata: { ...assinatura.metadata, userId: dados.userId, priceId: dados.priceId },
    });
    await notificar(
      dados.userId,
      "Plano atualizado",
      `Seu plano passou para ${novoPlano?.nome ?? dados.priceId} (${novoPreco?.rotulo ?? ""}) com efeito imediato. A diferença proporcional do período foi ajustada na fatura.`,
    );
  } else {
    // Downgrade: agenda a mudança para o início do próximo ciclo.
    const schedule = assinatura.schedule
      ? await stripe.subscriptionSchedules.retrieve(
          typeof assinatura.schedule === "string" ? assinatura.schedule : assinatura.schedule.id,
        )
      : await stripe.subscriptionSchedules.create({ from_subscription: assinatura.id });

    const faseAtual = schedule.phases[schedule.phases.length - 1];
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: faseAtual!.items.map((i) => ({
            price: typeof i.price === "string" ? i.price : i.price.id,
            quantity: i.quantity ?? 1,
          })),
          start_date: faseAtual!.start_date,
          end_date: faseAtual!.end_date,
        },
        { items: [{ price: stripePrice.id, quantity: 1 }] },
      ],
      metadata: { userId: dados.userId, priceIdAgendado: dados.priceId },
    });
    await notificar(
      dados.userId,
      "Troca de plano agendada",
      `Seu plano atual continua valendo até o fim do período pago. Na renovação, você passa para ${novoPlano?.nome ?? dados.priceId} (${novoPreco?.rotulo ?? ""}).`,
      "info",
    );
  }

  await registrarEvento({
    evento: tipo === "upgrade" ? "plano_upgrade" : "plano_downgrade_agendado",
    registradoPor: dados.userId,
    dados: {
      assinatura: assinatura.id,
      de: sub.price_id,
      para: dados.priceId,
      ambiente: dados.environment,
    },
  });

  return { tipo };
}

/** Cancelamento: imediato (corte na hora) ou ao fim do período pago. */
export async function cancelarPlano(dados: {
  userId: string;
  imediato: boolean;
  environment: StripeEnv;
}) {
  const sub = await assinaturaAtual(dados.userId, dados.environment);
  if (!sub) throw new Error("Nenhuma assinatura encontrada.");
  const stripe = createStripeClient(dados.environment);

  if (dados.imediato) {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id, { prorate: false });
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: false,
        current_period_end: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    await notificar(
      dados.userId,
      "Plano cancelado",
      "Seu plano foi cancelado e os benefícios foram encerrados imediatamente. A taxa administrativa padrão volta a valer nas próximas corridas.",
      "alerta",
    );
  } else {
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    await notificar(
      dados.userId,
      "Cancelamento agendado",
      "Seu plano permanece ativo até o fim do período já pago e não será renovado.",
      "info",
    );
  }

  await registrarEvento({
    evento: dados.imediato ? "plano_cancelado_imediato" : "plano_cancelamento_agendado",
    registradoPor: dados.userId,
    dados: {
      assinatura: sub.stripe_subscription_id,
      plano: sub.price_id,
      ambiente: dados.environment,
    },
  });

  return { imediato: dados.imediato };
}

/* ------------------------------------------------------------------ */
/* Cumprimento (chamado pelo webhook assinado)                         */
/* ------------------------------------------------------------------ */

function priceLegivel(item: any): string {
  return item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || "";
}

export async function registrarAssinatura(subscription: any, env: StripeEnv, criada: boolean) {
  const userId = subscription.metadata?.userId as string | undefined;
  const item = subscription.items?.data?.[0];
  const priceId = priceLegivel(item);
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const inicio = item?.current_period_start ?? subscription.current_period_start;
  const fim = item?.current_period_end ?? subscription.current_period_end;

  if (!userId) {
    console.error("Assinatura sem userId nos metadados:", subscription.id);
    return;
  }

  const registro = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    product_id: productId ?? "",
    price_id: priceId,
    status: subscription.status,
    current_period_start: inicio ? new Date(inicio * 1000).toISOString() : null,
    current_period_end: fim ? new Date(fim * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    environment: env,
    updated_at: new Date().toISOString(),
  };

  await supabaseAdmin.from("subscriptions").upsert(registro, { onConflict: "stripe_subscription_id" });

  const plano = planoDoPrice(priceId);
  if (criada && plano) {
    await notificar(
      userId,
      `${plano.nome} ativado`,
      `Seu plano está ativo. A taxa administrativa das suas corridas passa a ser ${plano.taxa.taxa_percentual}% + R$ ${plano.taxa.taxa_fixa.toFixed(2)}.`,
    );
  }

  await registrarEvento({
    evento: criada ? "assinatura_ativada" : "assinatura_atualizada",
    registradoPor: userId,
    dados: {
      assinatura: subscription.id,
      plano: priceId,
      status: subscription.status,
      fim_periodo: registro.current_period_end,
      cancelamento_agendado: registro.cancel_at_period_end,
      ambiente: env,
    },
  });
}

export async function encerrarAssinatura(subscription: any, env: StripeEnv) {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, price_id, current_period_end, cancel_at_period_end")
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env)
    .maybeSingle();

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  if (sub?.user_id) {
    await notificar(
      sub.user_id,
      "Plano encerrado",
      "Seu plano foi encerrado. A taxa administrativa padrão volta a valer nas próximas corridas.",
      "alerta",
    );
    await registrarEvento({
      evento: "assinatura_encerrada",
      registradoPor: sub.user_id,
      dados: { assinatura: subscription.id, plano: sub.price_id, ambiente: env },
    });
  }
}

/** Lança a fatura da assinatura na contabilidade. */
export async function registrarFaturaAssinatura(invoice: any, env: StripeEnv) {
  const linha = invoice.lines?.data?.[0];
  const priceId = priceLegivel(linha);
  const plano = planoDoPrice(priceId);
  const valor = arred(Number(invoice.amount_paid ?? invoice.total ?? 0) / 100);
  if (valor <= 0) return;

  const { data: existente } = await supabaseAdmin
    .from("lancamentos_contabeis")
    .select("id")
    .contains("detalhamento", { fatura: invoice.id })
    .maybeSingle();
  if (existente) return;

  await supabaseAdmin.from("lancamentos_contabeis").insert([
    {
      tipo: "receita_bruta",
      valor,
      descricao: `Assinatura ${plano?.nome ?? priceId}`,
      competencia: competencia(),
      detalhamento: {
        fatura: invoice.id,
        assinatura: invoice.subscription ?? null,
        plano: priceId,
        ambiente: env,
        origem: "assinatura",
      },
    },
    {
      tipo: "taxa_plataforma",
      valor,
      descricao: `Receita de assinatura destinada à manutenção automatizada da plataforma (${plano?.nome ?? priceId})`,
      competencia: competencia(),
      detalhamento: { fatura: invoice.id, plano: priceId, ambiente: env, origem: "assinatura" },
    },
  ]);
}

/** Credita o pacote de créditos comprado na carteira do usuário. */
export async function creditarCompraCreditos(session: any, env: StripeEnv) {
  const userId = session?.metadata?.userId as string | undefined;
  const priceId = session?.metadata?.priceId as string | undefined;
  if (!userId || !priceId) return;
  const pacote = pacotePorId(priceId);
  if (!pacote) return;

  const referencia = `sessao:${session.id}`;
  const { data: existente } = await supabaseAdmin
    .from("carteira_transacoes")
    .select("id")
    .eq("referencia_externa", referencia)
    .maybeSingle();
  if (existente) return;

  const pago = arred(Number(session.amount_total ?? 0) / 100);

  const { error } = await supabaseAdmin.from("carteira_transacoes").insert({
    user_id: userId,
    tipo: "credito_compra",
    valor: pacote.valor,
    descricao: `Compra de créditos — ${pacote.rotulo}`,
    referencia_externa: referencia,
    environment: env,
  });
  if (error) {
    console.error("Falha ao creditar carteira:", error.message);
    return;
  }

  if (pacote.bonus > 0) {
    await supabaseAdmin.from("carteira_transacoes").insert({
      user_id: userId,
      tipo: "credito_bonus",
      valor: pacote.bonus,
      descricao: `Bônus do pacote ${pacote.rotulo}`,
      referencia_externa: `${referencia}:bonus`,
      environment: env,
    });
  }

  await supabaseAdmin.from("lancamentos_contabeis").insert([
    {
      tipo: "receita_bruta",
      valor: pago,
      descricao: `Venda de créditos pré-pagos (${pacote.rotulo})`,
      competencia: competencia(),
      detalhamento: { sessao: session.id, pacote: priceId, ambiente: env, origem: "creditos" },
    },
  ]);

  await notificar(
    userId,
    "Créditos adicionados",
    `R$ ${(pacote.valor + pacote.bonus).toFixed(2)} em créditos entraram na sua carteira e serão usados para abater as próximas corridas.`,
  );

  await registrarEvento({
    evento: "creditos_comprados",
    registradoPor: userId,
    dados: {
      sessao: session.id,
      pacote: priceId,
      valor: pacote.valor,
      bonus: pacote.bonus,
      total_pago: pago,
      ambiente: env,
    },
  });
}

/** Saldo de créditos e extrato do usuário. */
export async function carteiraDoUsuario(userId: string, env: StripeEnv) {
  const [extrato, todas] = await Promise.all([
    supabaseAdmin
      .from("carteira_transacoes")
      .select("*")
      .eq("user_id", userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("carteira_transacoes")
      .select("tipo, valor")
      .eq("user_id", userId)
      .eq("environment", env),
  ]);
  const saldo = arred(
    (todas.data ?? []).reduce(
      (a, t) => a + (t.tipo === "debito_corrida" ? -Number(t.valor) : Number(t.valor)),
      0,
    ),
  );
  return { saldo, transacoes: extrato.data ?? [] };
}


export const CATALOGO = { PLANOS, PACOTES_CREDITO };
