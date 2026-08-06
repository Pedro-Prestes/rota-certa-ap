import { createFileRoute } from "@tanstack/react-router";
import { tratarWebhookStripe } from "@/lib/webhook-stripe.server";

/**
 * Caminho usado pelos destinos configurados na Stripe (`/webhooks/stripe`).
 * Sem `?env=`, o ambiente é inferido pelo segredo que validar a assinatura.
 */
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        const envHint = rawEnv === "sandbox" || rawEnv === "live" ? rawEnv : undefined;
        return tratarWebhookStripe(request, envHint);
      },
    },
  },
});
