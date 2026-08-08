import { createFileRoute } from "@tanstack/react-router";

/**
 * Repasse semanal automático dos saldos dos motoristas.
 * Agendado para toda segunda-feira às 06:00 (America/Belem = 09:00 UTC).
 * Protegida por segredo: a chamada precisa enviar o header `x-cron-secret`.
 */
function conferir(segredo: string, enviado: string) {
  if (!segredo || enviado.length !== segredo.length) return false;
  let iguais = 0;
  for (let i = 0; i < segredo.length; i += 1) iguais |= segredo.charCodeAt(i) ^ enviado.charCodeAt(i);
  return iguais === 0;
}

export const Route = createFileRoute("/api/public/repasses/semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredos = [
          process.env["CRON_RENOVACAO_SECRET"],
          process.env["ASSINATURA_CRON_SECRET"],
          process.env["SUPABASE_ANON_KEY"],
        ].filter((s): s is string => !!s);
        if (segredos.length === 0) return new Response("Rotina não configurada", { status: 503 });

        const enviado =
          request.headers.get("x-cron-secret") ?? request.headers.get("apikey") ?? "";
        if (!segredos.some((s) => conferir(s, enviado))) {
          return new Response("Não autorizado", { status: 401 });
        }


        try {
          const { processarRepasseSemanal } = await import("@/lib/carteira-motorista.server");
          return Response.json(await processarRepasseSemanal());
        } catch (e) {
          console.error("[repasses] falha na rotina semanal", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Falha na rotina de repasses." },
            { status: 500 },
          );
        }
      },
    },
  },
});
