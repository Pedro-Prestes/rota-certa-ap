import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import {
  assinaturaCarteiraAtual,
  ativarPlanoComCreditos,
  cancelarPlanoCarteira,
  trocarPlanoCarteira,
} from "@/lib/assinatura-carteira.server";
import { ehPriceValido } from "@/lib/planos";

const validarAmbiente = (env: string): StripeEnv => {
  if (env !== "sandbox" && env !== "live") throw new Error("Ambiente de cobrança inválido.");
  return env;
};

export const assinarComCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: StripeEnv }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Plano inválido.");
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      return await ativarPlanoComCreditos({
        userId: context.userId,
        priceId: data.priceId,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const trocarPlanoCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; environment: StripeEnv }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Plano inválido.");
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      return await trocarPlanoCarteira({
        userId: context.userId,
        priceId: data.priceId,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const encerrarPlanoCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imediato: boolean; environment: StripeEnv }) => {
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      return await cancelarPlanoCarteira({
        userId: context.userId,
        imediato: data.imediato,
        environment: data.environment,
      });
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const consultarAssinaturaCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => {
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    return await assinaturaCarteiraAtual(context.userId, data.environment);
  });
