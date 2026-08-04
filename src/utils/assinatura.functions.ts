import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import {
  cancelarPlano,
  carteiraDoUsuario,
  criarCheckoutProduto,
  criarPortalCobranca,
  trocarPlano,
} from "@/lib/assinatura.server";
import { ehPriceValido } from "@/lib/planos";

const validarAmbiente = (env: string): StripeEnv => {
  if (env !== "sandbox" && env !== "live") throw new Error("Ambiente de cobrança inválido.");
  return env;
};

async function emailDo(context: { supabase: any }) {
  const {
    data: { user },
  } = await context.supabase.auth.getUser();
  return (user?.email as string | undefined) ?? undefined;
}

export const criarCheckoutPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Produto inválido.");
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("URL de retorno inválida.");
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { assinaturaCarteiraVigente } = await import("@/lib/assinatura-carteira.server");
      const { precoPorId } = await import("@/lib/planos");
      if (precoPorId(data.priceId)) {
        const carteira = await assinaturaCarteiraVigente(context.userId, data.environment);
        if (carteira) {
          return {
            error:
              "Você já tem um plano ativo pago com créditos. Cancele-o antes de assinar pelo provedor.",
          };
        }
      }
      return await criarCheckoutProduto({
        priceId: data.priceId,
        userId: context.userId,
        email: await emailDo(context),
        returnUrl: data.returnUrl,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


export const abrirPortalCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      return await criarPortalCobranca({
        userId: context.userId,
        email: await emailDo(context),
        returnUrl: data.returnUrl,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const alterarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: StripeEnv }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Plano inválido.");
    validarAmbiente(data.environment);
    return data;
  })
  .handler(
    async ({ data, context }): Promise<{ tipo: "upgrade" | "downgrade" | "igual" } | { error: string }> => {
      try {
        return await trocarPlano({
          priceId: data.priceId,
          userId: context.userId,
          environment: data.environment,
        });
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    },
  );

export const encerrarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imediato: boolean; environment: StripeEnv }) => {
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }): Promise<{ imediato: boolean } | { error: string }> => {
    try {
      return await cancelarPlano({
        userId: context.userId,
        imediato: data.imediato,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const consultarCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    return await carteiraDoUsuario(context.userId, data.environment);
  });
