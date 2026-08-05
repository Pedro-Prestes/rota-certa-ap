import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

const uuid = /^[0-9a-fA-F-]{36}$/;
const dataISO = /^\d{4}-\d{2}-\d{2}$/;

function validarEnv(env: string): StripeEnv {
  if (env !== "sandbox" && env !== "live") throw new Error("Ambiente inválido.");
  return env;
}

/** Abre (ou recupera) a viagem do dia daquela rota e a coloca em busca dos passageiros. */
export const iniciarViagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string; dataViagem: string; veiculoId?: string }) => {
    if (!uuid.test(data.rotaId ?? "")) throw new Error("Rota inválida.");
    if (!dataISO.test(data.dataViagem ?? "")) throw new Error("Data inválida.");
    if (data.veiculoId && !uuid.test(data.veiculoId)) throw new Error("Veículo inválido.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const { data: rota, error: erroRota } = await supabase
        .from("rotas")
        .select("id, user_id")
        .eq("id", data.rotaId)
        .maybeSingle();
      if (erroRota) throw new Error(erroRota.message);
      if (!rota || rota.user_id !== userId) throw new Error("Rota não encontrada.");

      const { data: existente } = await supabase
        .from("viagens")
        .select("*")
        .eq("rota_id", data.rotaId)
        .eq("data_viagem", data.dataViagem)
        .maybeSingle();

      const patch = {
        status: "em_busca",
        iniciada_em: existente?.iniciada_em ?? new Date().toISOString(),
        concluida_em: null,
        ...(data.veiculoId ? { veiculo_id: data.veiculoId } : {}),
      };

      if (existente) {
        const { data: atualizada, error } = await supabase
          .from("viagens")
          .update(patch)
          .eq("id", existente.id)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return { viagem: atualizada };
      }

      const { data: criada, error } = await supabase
        .from("viagens")
        .insert({
          rota_id: data.rotaId,
          data_viagem: data.dataViagem,
          motorista_id: userId,
          veiculo_id: data.veiculoId ?? null,
          ...patch,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { viagem: criada };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Avança a viagem para "em viagem" (todos embarcados, saindo da cidade). */
export const marcarEmViagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { viagemId: string }) => {
    if (!uuid.test(data.viagemId ?? "")) throw new Error("Viagem inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { data: viagem, error } = await context.supabase
        .from("viagens")
        .update({ status: "em_viagem" })
        .eq("id", data.viagemId)
        .eq("motorista_id", context.userId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { viagem };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Encerra a viagem, consolida a distância percorrida e registra na auditoria. */
export const encerrarViagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { viagemId: string; environment: string }) => {
    if (!uuid.test(data.viagemId ?? "")) throw new Error("Viagem inválida.");
    return { viagemId: data.viagemId, environment: validarEnv(data.environment) };
  })
  .handler(async ({ data, context }) => {
    try {
      const { finalizarViagem } = await import("@/lib/viagem.server");
      return await finalizarViagem({
        viagemId: data.viagemId,
        motoristaId: context.userId,
        env: data.environment,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
