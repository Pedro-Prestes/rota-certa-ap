import { createFileRoute } from "@tanstack/react-router";
import { tratarWebhookStripe } from "@/lib/webhook-stripe.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        const envHint = rawEnv === "sandbox" || rawEnv === "live" ? rawEnv : undefined;
        if (rawEnv && !envHint) {
          console.error("Webhook com parâmetro env inválido:", rawEnv);
        }
        return tratarWebhookStripe(request, envHint);
      },
    },
  },
});
