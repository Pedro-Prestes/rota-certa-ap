import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntradaCooperativa } from "@/lib/cooperativa";

/** Painel da cooperativa: cadastro, carteira, motoristas, rateios e repasses. */
export const painelCooperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { painelCooperativa: painel } = await import("@/lib/cooperativa.server");
    return painel(context.userId);
  });

/** Cadastra ou atualiza a cooperativa, incluindo a conta de recebimento. */
export const salvarCooperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { dados: EntradaCooperativa }) => {
    if (!data?.dados) throw new Error("Dados da cooperativa ausentes.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { salvarCooperativa: salvar } = await import("@/lib/cooperativa.server");
    try {
      return { cooperativa: await salvar({ userId: context.userId, dados: data.dados }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível salvar a cooperativa." };
    }
  });

/** Vincula ou desvincula um motorista à cooperativa. */
export const vincularMotoristaCooperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cooperativaId: string; motoristaId: string; ativo: boolean }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.cooperativaId ?? "")) {
      throw new Error("Cooperativa inválida.");
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(data.motoristaId ?? "")) throw new Error("Motorista inválido.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { vincularMotorista } = await import("@/lib/cooperativa.server");
    try {
      return await vincularMotorista({
        userId: context.userId,
        cooperativaId: data.cooperativaId,
        motoristaId: data.motoristaId,
        ativo: !!data.ativo,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível vincular o motorista." };
    }
  });

/** Solicita o repasse do saldo acumulado da cooperativa. */
export const repassarCooperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cooperativaId: string; valor?: number }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.cooperativaId ?? "")) {
      throw new Error("Cooperativa inválida.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { cooperativaDoResponsavel, repassarCooperativa: repassar } = await import(
      "@/lib/cooperativa.server"
    );
    try {
      const coop = await cooperativaDoResponsavel(context.userId);
      if (!coop || coop.id !== data.cooperativaId) {
        return { error: "Cooperativa não encontrada para este responsável." };
      }
      return await repassar({
        cooperativaId: data.cooperativaId,
        ...(data.valor ? { valor: Number(data.valor) } : {}),
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível solicitar o repasse." };
    }
  });
