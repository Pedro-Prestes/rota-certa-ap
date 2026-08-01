import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { criarCheckoutCorrida } from "@/lib/cobranca.server";
import { getStripeErrorMessage } from "@/lib/stripe.server";
import type { StripeEnv } from "@/lib/stripe.server";
import type { ComposicaoCobranca } from "@/lib/taxas";

export const criarCobrancaCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      corridaId: string;
      returnUrl: string;
      environment: StripeEnv;
      valorBase?: number;
    }) => {
      if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
      if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("URL de retorno inválida.");
      if (data.environment !== "sandbox" && data.environment !== "live") {
        throw new Error("Ambiente de cobrança inválido.");
      }
      return data;
    },
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ clientSecret: string; composicao: ComposicaoCobranca } | { error: string }> => {
      try {
        const {
          data: { user },
        } = await context.supabase.auth.getUser();
        return await criarCheckoutCorrida({
          corridaId: data.corridaId,
          userId: context.userId,
          email: user?.email ?? undefined,
          returnUrl: data.returnUrl,
          environment: data.environment,
          valorBase: data.valorBase,
        });
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    },
  );
