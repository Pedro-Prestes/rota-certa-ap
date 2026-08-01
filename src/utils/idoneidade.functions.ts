import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verificarIdoneidade } from "@/lib/idoneidade.server";
import type { AlvoVerificacao } from "@/lib/idoneidade";

export const consultarIdoneidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      alvo: AlvoVerificacao;
      documento: string;
      nome?: string;
      cnh?: string;
      dataNascimento?: string;
      veiculoId?: string;
    }) => {
      if (!["passageiro", "motorista", "veiculo"].includes(data.alvo)) {
        throw new Error("Tipo de verificação inválido.");
      }
      if (data.alvo !== "veiculo" && !data.documento) throw new Error("Informe o CPF.");
      if (data.veiculoId && !/^[0-9a-fA-F-]{36}$/.test(data.veiculoId)) {
        throw new Error("Veículo inválido.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      return await verificarIdoneidade({
        alvo: data.alvo,
        userId: context.userId,
        documento: data.documento ?? "",
        nome: data.nome,
        cnh: data.cnh,
        dataNascimento: data.dataNascimento,
        veiculoId: data.veiculoId,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
