import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = (v: unknown) => {
  if (typeof v !== "string" || !/^[0-9a-fA-F-]{36}$/.test(v)) throw new Error("Motorista inválido.");
  return v;
};

/** Motoristas e a situação da liberação manual — exclusivo do administrador master. */
export const listarMotoristasLiberacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { termo?: string } | undefined) => ({
    termo: typeof data?.termo === "string" ? data.termo.slice(0, 120) : "",
  }))
  .handler(async ({ data, context }) => {
    const { listarMotoristasLiberacao: listar } = await import(
      "@/lib/credenciamento-liberacao.server"
    );
    try {
      return { motoristas: await listar(context.userId, data.termo) };
    } catch (e) {
      return { motoristas: [], error: (e as Error).message };
    }
  });

/** Ativa o credenciamento do motorista nas fases escolhidas pelo master. */
export const liberarCredenciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      userId: string;
      fase1: boolean;
      fase2: boolean;
      fase3: boolean;
      motivo: string;
    }) => ({
      userId: uuid(data?.userId),
      fase1: !!data?.fase1,
      fase2: !!data?.fase2,
      fase3: !!data?.fase3,
      motivo: typeof data?.motivo === "string" ? data.motivo : "",
    }),
  )
  .handler(async ({ data, context }) => {
    const { liberarCredenciamento: liberar } = await import(
      "@/lib/credenciamento-liberacao.server"
    );
    try {
      return await liberar({
        adminId: context.userId,
        userId: data.userId,
        fases: { fase1: data.fase1, fase2: data.fase2, fase3: data.fase3 },
        motivo: data.motivo,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Revoga a liberação manual do credenciamento. */
export const revogarLiberacaoCredenciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => ({ userId: uuid(data?.userId) }))
  .handler(async ({ data, context }) => {
    const { revogarLiberacao } = await import("@/lib/credenciamento-liberacao.server");
    try {
      return await revogarLiberacao({ adminId: context.userId, userId: data.userId });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
