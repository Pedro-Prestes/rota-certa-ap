import { createFileRoute } from "@tanstack/react-router";
import { renovarAssinaturasCarteira } from "@/lib/assinatura-carteira.server";

/**
 * Rotina de renovação das assinaturas pagas com créditos.
 * Protegida por segredo: a chamada precisa enviar o header `x-cron-secret`.
 */
async function executar(request: Request) {
  const segredo = process.env["ASSINATURA_CRON_SECRET"];
  if (!segredo) return new Response("Rotina não configurada", { status: 503 });

  const enviado = request.headers.get("x-cron-secret") ?? "";
  if (enviado.length !== segredo.length) return new Response("Não autorizado", { status: 401 });
  let iguais = 0;
  for (let i = 0; i < segredo.length; i += 1) iguais |= segredo.charCodeAt(i) ^ enviado.charCodeAt(i);
  if (iguais !== 0) return new Response("Não autorizado", { status: 401 });

  const url = new URL(request.url);
  const rawEnv = url.searchParams.get("env") ?? "live";
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response("Ambiente inválido", { status: 400 });
  }

  try {
    const resultado = await renovarAssinaturasCarteira(rawEnv);
    return Response.json({ ok: true, ambiente: rawEnv, ...resultado });
  } catch (e) {
    console.error("Erro na renovação de assinaturas por créditos:", e);
    return new Response("Erro na rotina", { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/assinaturas/renovar")({
  server: {
    handlers: {
      POST: async ({ request }) => executar(request),
      GET: async ({ request }) => executar(request),
    },
  },
});
