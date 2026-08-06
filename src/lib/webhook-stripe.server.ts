/**
 * Tratamento dos webhooks da Stripe, compartilhado pelas rotas
 * `/api/public/payments/webhook` e `/api/public/webhooks/stripe`.
 */
import { hidratarEvento, verifyWebhookAny, type StripeEnv } from "./stripe.server";
import { confirmarPagamentoSessao } from "./cobranca.server";
import {
  creditarCompraCreditos,
  encerrarAssinatura,
  registrarAssinatura,
  registrarFaturaAssinatura,
} from "./assinatura.server";

async function cumprirSessao(session: any, env: StripeEnv) {
  const tipo = session?.metadata?.tipo;
  if (tipo === "creditos") {
    await creditarCompraCreditos(session, env);
    return;
  }
  if (tipo === "protecao") {
    const { confirmarProtecao } = await import("./seguro.server");
    await confirmarProtecao(session, env);
    return;
  }
  if (tipo === "assinatura") {
    // A ativação do plano é feita pelos eventos customer.subscription.*
    return;
  }
  await confirmarPagamentoSessao(session, env);
}

async function despachar(event: { type: string; data: { object: any } }, env: StripeEnv) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        await cumprirSessao(session, env);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await cumprirSessao(event.data.object, env);
      break;
    case "checkout.session.async_payment_failed":
      console.log("Pagamento não confirmado para a sessão", event.data.object?.id);
      break;
    case "customer.subscription.created":
      await registrarAssinatura(event.data.object, env, true);
      break;
    case "customer.subscription.updated":
      await registrarAssinatura(event.data.object, env, false);
      break;
    case "customer.subscription.deleted":
      await encerrarAssinatura(event.data.object, env);
      break;
    case "invoice.paid":
      await registrarFaturaAssinatura(event.data.object, env);
      break;
    default:
      console.log("Evento não tratado:", event.type);
  }
}

/**
 * Verifica a assinatura, hidrata payloads no estilo "Mínimo" e processa o evento.
 * `envHint` vem da query `?env=`; sem ela o ambiente é inferido pelo segredo válido.
 */
export async function tratarWebhookStripe(
  request: Request,
  envHint?: StripeEnv,
): Promise<Response> {
  try {
    const verificado = await verifyWebhookAny(request, envHint);
    const event = await hidratarEvento(verificado);
    console.log("Webhook Stripe verificado:", {
      tipo: event.type,
      segredo: verificado.segredo,
      ambiente: verificado.env,
      estilo: verificado.estilo,
      hidratado: verificado.estilo === "minimo",
    });
    await despachar(event, verificado.env);
    return Response.json({ received: true });
  } catch (e) {
    console.error("Erro no webhook Stripe:", e);
    return new Response("Webhook error", { status: 400 });
  }
}
