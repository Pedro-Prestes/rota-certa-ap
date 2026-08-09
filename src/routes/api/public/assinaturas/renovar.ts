import { createFileRoute } from "@tanstack/react-router";
import { renovarAssinaturasCarteira } from "@/lib/assinatura-carteira.server";

/**
 * Rotina de renovação das assinaturas pagas com créditos.
 * Protegida por segredo: a chamada precisa enviar o header `x-cron-secret`.
 */
/** Comparação de tempo constante entre o segredo esperado e o recebido. */
function conferir(segredo: string, enviado: string) {
  if (!segredo || enviado.length !== segredo.length) return false;
  let iguais = 0;
  for (let i = 0; i < segredo.length; i += 1) iguais |= segredo.charCodeAt(i) ^ enviado.charCodeAt(i);
  return iguais === 0;
}

async function executar(request: Request) {
  // Aceita o segredo do agendamento (pg_cron) e o segredo legado.
  const segredos = [
    process.env["CRON_RENOVACAO_SECRET"],
    process.env["ASSINATURA_CRON_SECRET"],
  ].filter((s): s is string => !!s);
  if (segredos.length === 0) return new Response("Rotina não configurada", { status: 503 });

  const enviado = request.headers.get("x-cron-secret") ?? "";
  if (!segredos.some((s) => conferir(s, enviado))) {
    return new Response("Não autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const rawEnv = url.searchParams.get("env") ?? "live";
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response("Ambiente inválido", { status: 400 });
  }

  try {
    const { renovarCoberturas } = await import("@/lib/seguro.server");
    const { processarCortesias } = await import("@/lib/promocao.server");
    const [resultado, coberturas, cortesias] = await Promise.all([
      renovarAssinaturasCarteira(rawEnv),
      renovarCoberturas(rawEnv),
      processarCortesias(rawEnv),
    ]);
    return Response.json({ ok: true, ambiente: rawEnv, ...resultado, coberturas, cortesias });
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
