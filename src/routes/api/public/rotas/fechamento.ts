import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina de fechamento das saídas (minuto a minuto).
 * Fecha as saídas que entraram na janela de 60 minutos antes da partida,
 * calcula o preço dinâmico e avança a fila de confirmação.
 * Protegida por segredo: a chamada precisa enviar o header `x-cron-secret`.
 */
function conferir(segredo: string, enviado: string) {
  if (!segredo || enviado.length !== segredo.length) return false;
  let iguais = 0;
  for (let i = 0; i < segredo.length; i += 1) {
    iguais |= segredo.charCodeAt(i) ^ enviado.charCodeAt(i);
  }
  return iguais === 0;
}

async function executar(request: Request) {
  const segredos = [
    process.env["CRON_FECHAMENTO_SECRET"],
    process.env["CRON_RENOVACAO_SECRET"],
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
    const { processarFechamentos } = await import("@/lib/fechamento.server");
    const resultado = await processarFechamentos(rawEnv);
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    console.error("Erro na rotina de fechamento de saídas:", e);
    return new Response("Erro na rotina", { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/rotas/fechamento")({
  server: {
    handlers: {
      POST: async ({ request }) => executar(request),
      GET: async ({ request }) => executar(request),
    },
  },
});
