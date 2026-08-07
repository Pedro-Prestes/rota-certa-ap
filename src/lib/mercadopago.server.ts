/**
 * Gateway Mercado Pago — pagamentos Pix.
 *
 * Fluxo:
 *  1. O usuário escolhe um plano mensal ou um pacote de créditos.
 *  2. O servidor valida o preço no catálogo (nunca confia no valor do cliente),
 *     calcula a taxa administrativa da plataforma e grava a transação como
 *     `pending` em `pagamentos_pix`.
 *  3. Cria o pagamento Pix na API do Mercado Pago e devolve o QR Code.
 *  4. O webhook (assíncrono e idempotente) credita a carteira e, quando a
 *     finalidade é assinatura, ativa o plano debitando os créditos.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pacotePorId, planoDoPrice, precoPorId } from "./planos";
import { ativarPlanoComCreditos } from "./assinatura-carteira.server";
import { registrarEvento } from "./blockchain.server";

const MP_API = "https://api.mercadopago.com";

export type MpEnv = "sandbox" | "live";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

function accessToken(): string {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) throw new Error("O Pix do Mercado Pago ainda não está configurado na plataforma.");
  return token;
}

/** Taxa administrativa da plataforma, configurável por variáveis de ambiente. */
export function taxaAdministrativa() {
  const percentual = Number(process.env["PROJECT_ADMIN_FEE_PERCENTAGE"] ?? "0") || 0;
  const fixa = Number(process.env["PROJECT_ADMIN_FEE_FIXED"] ?? "0") || 0;
  return { percentual, fixa };
}

export interface ComposicaoPix {
  base: number;
  taxaPercentual: number;
  taxaFixa: number;
  taxaAdmin: number;
  total: number;
}

export function comporValorPix(base: number): ComposicaoPix {
  const { percentual, fixa } = taxaAdministrativa();
  const seguro = Math.max(0, Number(base) || 0);
  const taxaAdmin = arred((seguro * percentual) / 100 + fixa);
  return {
    base: seguro,
    taxaPercentual: percentual,
    taxaFixa: arred(fixa),
    taxaAdmin,
    total: arred(seguro + taxaAdmin),
  };
}

/** Resolve o item vendido a partir do catálogo interno. */
export function itemDoPrice(priceId: string) {
  const pacote = pacotePorId(priceId);
  if (pacote) {
    return {
      finalidade: "creditos" as const,
      base: pacote.valor,
      creditos: arred(pacote.valor + pacote.bonus),
      descricao: `RotaCerta — ${pacote.rotulo}`,
    };
  }
  const preco = precoPorId(priceId);
  const plano = planoDoPrice(priceId);
  if (preco && plano) {
    if (preco.periodicidade !== "mensal") {
      throw new Error("Pelo Pix, as assinaturas são cobradas mês a mês. Escolha o plano mensal.");
    }
    return {
      finalidade: "assinatura" as const,
      base: preco.valor,
      creditos: preco.valor,
      descricao: `RotaCerta — Assinatura ${plano.nome} (${preco.rotulo})`,
    };
  }
  throw new Error("Plano ou pacote inválido.");
}

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { idempotencyKey, ...rest } = init;
  const resposta = await fetch(`${MP_API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, any>;
  if (!resposta.ok) {
    const detalhe =
      corpo?.["message"] ?? corpo?.["error"] ?? `Mercado Pago respondeu ${resposta.status}`;
    throw new Error(String(detalhe));
  }
  return corpo;
}

export interface PixCriado {
  pagamentoId: string;
  providerId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiraEm: string | null;
  composicao: ComposicaoPix;
  creditos: number;
  descricao: string;
}

/** Cria a transação interna e o pagamento Pix no Mercado Pago. */
export async function criarPagamentoPix(dados: {
  userId: string;
  priceId: string;
  email: string;
  nome?: string;
  cpf?: string;
  environment?: MpEnv;
  notificationUrl: string;
}): Promise<PixCriado> {
  const item = itemDoPrice(dados.priceId);
  const composicao = comporValorPix(item.base);
  const env: MpEnv = dados.environment ?? "live";

  const { data: registro, error } = await supabaseAdmin
    .from("pagamentos_pix")
    .insert({
      user_id: dados.userId,
      price_id: dados.priceId,
      finalidade: item.finalidade,
      descricao: item.descricao,
      valor_base: composicao.base,
      taxa_percentual: composicao.taxaPercentual,
      taxa_fixa: composicao.taxaFixa,
      taxa_admin: composicao.taxaAdmin,
      valor_total: composicao.total,
      creditos: item.creditos,
      status: "pending",
      environment: env,
    })
    .select("id")
    .single();
  if (error || !registro) {
    throw new Error(error?.message ?? "Não foi possível registrar a cobrança.");
  }

  const [primeiro, ...resto] = (dados.nome ?? "").trim().split(/\s+/).filter(Boolean);
  const payload: Record<string, unknown> = {
    transaction_amount: composicao.total,
    description: item.descricao,
    payment_method_id: "pix",
    payer: {
      email: dados.email,
      ...(primeiro ? { first_name: primeiro } : {}),
      ...(resto.length ? { last_name: resto.join(" ") } : {}),
      ...(dados.cpf
        ? { identification: { type: "CPF", number: dados.cpf.replace(/\D/g, "") } }
        : {}),
    },
    notification_url: dados.notificationUrl,
    metadata: {
      user_id: dados.userId,
      plan_id: dados.priceId,
      finalidade: item.finalidade,
      credits_to_add: item.creditos,
      base_amount: composicao.base,
      admin_fee: composicao.taxaAdmin,
      internal_transaction_id: registro.id,
      environment: env,
    },
  };

  let pagamento: Record<string, any>;
  try {
    pagamento = await mpFetch("/v1/payments", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: registro.id,
    });
  } catch (e) {
    await supabaseAdmin
      .from("pagamentos_pix")
      .update({ status: "erro" })
      .eq("id", registro.id);
    throw e;
  }

  const transferencia = pagamento?.["point_of_interaction"]?.transaction_data ?? {};
  const atualizacao = {
    provedor_payment_id: String(pagamento["id"]),
    status: String(pagamento["status"] ?? "pending"),
    qr_code: transferencia.qr_code ?? null,
    qr_code_base64: transferencia.qr_code_base64 ?? null,
    ticket_url: transferencia.ticket_url ?? null,
    expira_em: pagamento["date_of_expiration"] ?? null,
  };
  await supabaseAdmin.from("pagamentos_pix").update(atualizacao).eq("id", registro.id);

  return {
    pagamentoId: registro.id,
    providerId: atualizacao.provedor_payment_id,
    status: atualizacao.status,
    qrCode: atualizacao.qr_code,
    qrCodeBase64: atualizacao.qr_code_base64,
    ticketUrl: atualizacao.ticket_url,
    expiraEm: atualizacao.expira_em,
    composicao,
    creditos: item.creditos,
    descricao: item.descricao,
  };
}

/** Consulta o pagamento no provedor e sincroniza o status/liquidação. */
export async function sincronizarPagamentoPix(providerId: string) {
  const pagamento = await mpFetch(`/v1/payments/${providerId}`);
  return aplicarStatusPagamento(pagamento);
}

/** Aplica o status do provedor à transação interna, de forma idempotente. */
export async function aplicarStatusPagamento(pagamento: Record<string, any>) {
  const providerId = String(pagamento?.["id"] ?? "");
  if (!providerId) return { status: "ignorado" as const };

  const interno = pagamento?.["metadata"]?.internal_transaction_id as string | undefined;
  const { data: registro } = interno
    ? await supabaseAdmin.from("pagamentos_pix").select("*").eq("id", interno).maybeSingle()
    : await supabaseAdmin
        .from("pagamentos_pix")
        .select("*")
        .eq("provedor_payment_id", providerId)
        .maybeSingle();
  if (!registro) return { status: "ignorado" as const };

  const status = String(pagamento["status"] ?? registro.status);
  await supabaseAdmin
    .from("pagamentos_pix")
    .update({ status, provedor_payment_id: providerId })
    .eq("id", registro.id);

  if (status !== "approved" || registro.creditado_em) {
    return { status, creditado: Boolean(registro.creditado_em) };
  }

  await creditarPagamentoAprovado(registro as PagamentoPixRow, providerId);
  return { status, creditado: true };
}

export interface PagamentoPixRow {
  id: string;
  user_id: string;
  price_id: string;
  finalidade: string;
  descricao: string;
  valor_base: number;
  taxa_admin: number;
  valor_total: number;
  creditos: number;
  status: string;
  creditado_em: string | null;
  environment: string;
}

async function creditarPagamentoAprovado(registro: PagamentoPixRow, providerId: string) {
  const env = registro.environment === "sandbox" ? "sandbox" : "live";
  const referencia = `mercadopago:${providerId}`;

  const { data: existente } = await supabaseAdmin
    .from("carteira_transacoes")
    .select("id")
    .eq("referencia_externa", referencia)
    .maybeSingle();

  if (!existente) {
    const { error } = await supabaseAdmin.from("carteira_transacoes").insert({
      user_id: registro.user_id,
      tipo: "credito_compra",
      valor: Number(registro.creditos),
      descricao: `Pix aprovado — ${registro.descricao}`,
      referencia_externa: referencia,
      environment: env,
    });
    if (error) throw new Error(`Falha ao creditar a carteira: ${error.message}`);

    await supabaseAdmin.from("lancamentos_contabeis").insert([
      {
        tipo: "receita_bruta",
        valor: Number(registro.valor_total),
        descricao: `Pix (Mercado Pago) — ${registro.descricao}`,
        competencia: competencia(),
        detalhamento: {
          origem: "mercadopago_pix",
          pagamento: providerId,
          transacao_interna: registro.id,
          valor_base: Number(registro.valor_base),
          taxa_administrativa: Number(registro.taxa_admin),
          ambiente: env,
        },
      },
      {
        tipo: "taxa_plataforma",
        valor: Number(registro.taxa_admin),
        descricao: `Taxa administrativa da plataforma sobre ${registro.descricao}`,
        competencia: competencia(),
        detalhamento: {
          origem: "mercadopago_pix",
          pagamento: providerId,
          transacao_interna: registro.id,
          ambiente: env,
        },
      },
    ]);
  }

  await supabaseAdmin
    .from("pagamentos_pix")
    .update({ creditado_em: new Date().toISOString() })
    .eq("id", registro.id);

  await supabaseAdmin.from("notificacoes").insert({
    user_id: registro.user_id,
    titulo: "Pix confirmado",
    mensagem: `Recebemos R$ ${Number(registro.valor_total).toFixed(2)} e adicionamos R$ ${Number(
      registro.creditos,
    ).toFixed(2)} em créditos na sua carteira.`,
    tipo: "sucesso",
  });

  await registrarEvento({
    evento: "pix_aprovado",
    registradoPor: registro.user_id,
    dados: {
      pagamento: providerId,
      transacao_interna: registro.id,
      valor_total: Number(registro.valor_total),
      taxa_administrativa: Number(registro.taxa_admin),
      creditos: Number(registro.creditos),
      ambiente: env,
    },
  });

  if (registro.finalidade === "assinatura") {
    try {
      await ativarPlanoComCreditos({
        userId: registro.user_id,
        priceId: registro.price_id,
        environment: env,
      });
    } catch (e) {
      console.error("Pix aprovado, mas o plano não foi ativado:", e);
    }
  }
}

/**
 * Valida a assinatura `x-signature` do webhook do Mercado Pago.
 * Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export function validarAssinaturaWebhook(params: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const segredo = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!segredo) return false;
  if (!params.signature) return false;

  const partes = Object.fromEntries(
    params.signature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k?.trim() ?? "", v.join("=").trim()];
    }),
  );
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifesto = `id:${(params.dataId ?? "").toLowerCase()};${
    params.requestId ? `request-id:${params.requestId};` : ""
  }ts:${ts};`;
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Processa a notificação do webhook de forma idempotente. */
export async function tratarWebhookMercadoPago(request: Request): Promise<Response> {
  const cru = await request.text();
  const url = new URL(request.url);
  const corpo = (() => {
    try {
      return JSON.parse(cru) as Record<string, any>;
    } catch {
      return {} as Record<string, any>;
    }
  })();

  const dataId = String(
    corpo?.["data"]?.id ?? corpo?.["resource"] ?? url.searchParams.get("data.id") ?? "",
  ).replace(/^.*\//, "");

  const assinaturaOk = validarAssinaturaWebhook({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!assinaturaOk) {
    console.error("Webhook Mercado Pago com assinatura inválida.");
    return new Response("Assinatura inválida", { status: 401 });
  }

  if (!dataId) return new Response("ok");

  const eventoId = String(corpo?.["id"] ?? `${dataId}:${corpo?.["action"] ?? "payment"}`);
  const { error: dup } = await supabaseAdmin
    .from("webhook_eventos")
    .insert({
      provedor: "mercadopago",
      evento_id: eventoId,
      tipo: String(corpo?.["action"] ?? corpo?.["type"] ?? "payment"),
      payload: corpo,
    });
  if (dup) {
    // Chave duplicada = notificação já processada.
    if (dup.code === "23505") return new Response("ok");
    console.error("Falha ao registrar evento de webhook:", dup.message);
  }

  try {
    await sincronizarPagamentoPix(dataId);
  } catch (e) {
    console.error("Falha ao processar webhook do Mercado Pago:", e);
    return new Response("Erro ao processar", { status: 500 });
  }

  return new Response("ok");
}
