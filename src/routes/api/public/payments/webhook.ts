import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { confirmarPagamentoSessao } from "@/lib/cobranca.server";

async function tratar(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        await confirmarPagamentoSessao(session, env);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await confirmarPagamentoSessao(event.data.object, env);
      break;
    case "checkout.session.async_payment_failed":
      console.log("Pagamento não confirmado para a sessão", event.data.object?.id);
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
