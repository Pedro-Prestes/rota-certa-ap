import { createFileRoute } from "@tanstack/react-router";
import { tratarWebhookMercadoPago } from "@/lib/mercadopago.server";

/** Destino das notificações do Mercado Pago (Pix). Assinatura validada no handler. */
export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => tratarWebhookMercadoPago(request),
    },
  },
});
