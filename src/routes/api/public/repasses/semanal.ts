import { createFileRoute } from "@tanstack/react-router";

/**
 * Repasse semanal automático dos saldos dos motoristas.
 * Agendado para toda segunda-feira às 06:00 (America/Belem = 09:00 UTC).
 */
export const Route = createFileRoute("/api/public/repasses/semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env["CRON_RENOVACAO_SECRET"];
        const enviado =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!esperado || enviado !== esperado) {
          return new Response("Não autorizado", { status: 401 });
        }

        try {
          const { processarRepasseSemanal } = await import("@/lib/carteira-motorista.server");
          const resultado = await processarRepasseSemanal();
          return Response.json(resultado);
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
