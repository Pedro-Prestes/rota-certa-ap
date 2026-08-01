import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { processarEstorno } from "@/lib/cobranca.server";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import type { StripeEnv } from "@/lib/stripe.server";

export const estornarPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      pagamentoId: string;
      valor: number;
      motivo: string;
      devolveTaxa: boolean;
      environment: StripeEnv;
    }) => {
      if (!/^[0-9a-fA-F-]{36}$/.test(data.pagamentoId)) throw new Error("Pagamento inválido.");
      if (!(Number(data.valor) > 0)) throw new Error("Informe um valor de estorno maior que zero.");
      if (!data.motivo || data.motivo.trim().length < 5) {
        throw new Error("Descreva o motivo do estorno (mínimo 5 caracteres).");
      }
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Ambiente de cobrança inválido.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error || !admin) return { error: "Apenas o administrador master pode estornar valores." };

    try {
      const resultado = await processarEstorno({
        pagamentoId: data.pagamentoId,
        valor: Number(data.valor),
        motivo: data.motivo.trim(),
        devolveTaxa: !!data.devolveTaxa,
        adminId: context.userId,
        environment: data.environment,
      });
      return resultado;
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
