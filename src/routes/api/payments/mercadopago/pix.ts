import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { criarPagamentoPix } from "@/lib/mercadopago.server";
import { ehPriceValido } from "@/lib/planos";

const corpo = z.object({
  price_id: z.string().min(3).max(80),
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF inválido")
    .optional(),
  environment: z.enum(["sandbox", "live"]).optional(),
});

const URL_WEBHOOK_PADRAO = "https://rota-certa-ap.lovable.app/api/public/webhooks/mercadopago";

/**
 * Endpoint HTTP autenticado por bearer token do usuário.
 * Cria a transação interna (pending) e o pagamento Pix no Mercado Pago.
 */
export const Route = createFileRoute("/api/payments/mercadopago/pix")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const autorizacao = request.headers.get("authorization");
        const token = autorizacao?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Não autorizado", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {
          data: { user },
          error: erroAuth,
        } = await supabaseAdmin.auth.getUser(token);
        if (erroAuth || !user?.email) return new Response("Não autorizado", { status: 401 });

        const analise = corpo.safeParse(await request.json().catch(() => null));
        if (!analise.success || !ehPriceValido(analise.data.price_id)) {
          return Response.json({ error: "Dados inválidos." }, { status: 400 });
        }

        const { data: perfil } = await supabaseAdmin
          .from("profiles")
          .select("nome_completo")
          .eq("id", user.id)
          .maybeSingle();

        try {
          const pix = await criarPagamentoPix({
            userId: user.id,
            priceId: analise.data.price_id,
            email: user.email,
            ...(perfil?.nome_completo ? { nome: perfil.nome_completo } : {}),
            ...(analise.data.cpf ? { cpf: analise.data.cpf } : {}),
            environment: analise.data.environment ?? "live",
            notificationUrl: process.env["MERCADOPAGO_NOTIFICATION_URL"] ?? URL_WEBHOOK_PADRAO,
          });
          return Response.json(pix, { status: 201 });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Falha ao gerar o Pix." },
            { status: 400 },
          );
        }
      },
    },
  },
});
