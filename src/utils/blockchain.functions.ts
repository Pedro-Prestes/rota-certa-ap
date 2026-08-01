import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarEventoCorrida } from "@/lib/registro.server";

export const registrarBloco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { evento: string; corridaId: string; dados?: Record<string, unknown> }) => {
      if (!["corrida_criada", "trajeto_registrado"].includes(data.evento)) {
        throw new Error("Evento não permitido.");
      }
      if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      return await registrarEventoCorrida({
        evento: data.evento,
        corridaId: data.corridaId,
        userId: context.userId,
        dados: data.dados ?? {},
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
