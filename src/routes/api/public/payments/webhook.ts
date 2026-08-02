import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { confirmarPagamentoSessao } from "@/lib/cobranca.server";
import {
  creditarCompraCreditos,
  encerrarAssinatura,
  registrarAssinatura,
  registrarFaturaAssinatura,
} from "@/lib/assinatura.server";

async function cumprirSessao(session: any, env: StripeEnv) {
  const tipo = session?.metadata?.tipo;
  if (tipo === "creditos") {
    await creditarCompraCreditos(session, env);
    return;
  }
  if (tipo === "assinatura") {
    // A ativação do plano é feita pelos eventos customer.subscription.*
    return;
  }
  await confirmarPagamentoSessao(session, env);
}

async function tratar(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);

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

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook com parâmetro env inválido:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await tratar(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Erro no webhook:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
