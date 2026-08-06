import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox" ? getEnv("STRIPE_SANDBOX_API_KEY") : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }

  return "Stripe request failed";
}

type Candidato = { nome: string; valor: string; env: StripeEnv };

/** Segredos aceitos na verificação: gerenciados + o segredo dos destinos custom. */
function candidatosDeSegredo(envHint?: StripeEnv): Candidato[] {
  const lista: Candidato[] = [];
  const add = (nome: string, env: StripeEnv) => {
    const valor = process.env[nome];
    if (valor && !lista.some((c) => c.valor === valor)) lista.push({ nome, valor, env });
  };
  if (!envHint || envHint === "live") add("PAYMENTS_LIVE_WEBHOOK_SECRET", "live");
  if (!envHint || envHint === "sandbox") add("PAYMENTS_SANDBOX_WEBHOOK_SECRET", "sandbox");
  add("STRIPE_WEBHOOK_SECRET", envHint ?? "live");
  return lista;
}

/** Comparação em tempo constante entre duas assinaturas em hexadecimal. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function assinar(segredo: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(new Uint8Array(signed)).toString("hex");
}

export type WebhookVerificado = {
  event: { type: string; data: { object: any } };
  /** Nome do segredo que validou a assinatura (para diagnóstico, sem expor o valor). */
  segredo: string;
  /** Ambiente inferido a partir do segredo que validou. */
  env: StripeEnv;
  /** Estilo do conteúdo entregue pela Stripe. */
  estilo: "instantaneo" | "minimo";
};

/**
 * Verifica a assinatura do webhook contra todos os segredos configurados
 * (gerenciados do ambiente + `STRIPE_WEBHOOK_SECRET` dos destinos custom).
 */
export async function verifyWebhookAny(
  req: Request,
  envHint?: StripeEnv,
): Promise<WebhookVerificado> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (!value) continue;
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const candidatos = candidatosDeSegredo(envHint);
  if (candidatos.length === 0) throw new Error("No webhook secret configured");

  for (const candidato of candidatos) {
    const esperado = await assinar(candidato.valor, `${timestamp}.${body}`);
    if (v1Signatures.some((s) => iguaisEmTempoConstante(s, esperado))) {
      const event = JSON.parse(body) as { type: string; data: { object: any } };
      const obj = event.data?.object ?? {};
      const estilo = Object.keys(obj).length > 6 ? "instantaneo" : "minimo";
      return { event, segredo: candidato.nome, env: candidato.env, estilo };
    }
  }

  throw new Error("Invalid webhook signature");
}

/** Compatibilidade: retorna apenas o evento verificado. */
export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ type: string; data: { object: any } }> {
  const { event } = await verifyWebhookAny(req, env);
  return event;
}

/**
 * Destinos com estilo "Mínimo" enviam apenas o `id` do objeto.
 * Busca o objeto completo na Stripe antes de processar o evento.
 */
export async function hidratarEvento(
  verificado: WebhookVerificado,
): Promise<{ type: string; data: { object: any } }> {
  const { event, env, estilo } = verificado;
  const obj = event.data?.object;
  const id: unknown = obj?.id;
  if (estilo === "instantaneo" || typeof id !== "string") return event;

  const stripe = createStripeClient(env);
  try {
    let completo: any = null;
    if (id.startsWith("cs_")) completo = await stripe.checkout.sessions.retrieve(id);
    else if (id.startsWith("sub_")) completo = await stripe.subscriptions.retrieve(id);
    else if (id.startsWith("in_")) completo = await stripe.invoices.retrieve(id);
    else if (id.startsWith("pi_")) completo = await stripe.paymentIntents.retrieve(id);
    else if (id.startsWith("ch_")) completo = await stripe.charges.retrieve(id);
    if (!completo) return event;
    return { ...event, data: { ...event.data, object: completo } };
  } catch (e) {
    console.error("Falha ao buscar objeto completo do evento", event.type, id, e);
    return event;
  }
}

