import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";
import { ehPriceValido } from "@/lib/planos";

const uuid = /^[0-9a-fA-F-]{36}$/;

/** A simulação existe apenas no ambiente de teste. */
function validarSandbox(env: string): StripeEnv {
  if (env !== "sandbox") throw new Error("A simulação só está disponível no ambiente de teste.");
  return env;
}

function validarForma(f: string): "pix" | "credito" | "debito" {
  if (f !== "pix" && f !== "credito" && f !== "debito") throw new Error("Forma de pagamento inválida.");
  return f;
}

export const simularCompra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; forma: string; environment: string }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Produto inválido.");
    return {
      priceId: data.priceId,
      forma: validarForma(data.forma),
      environment: validarSandbox(data.environment),
    };
  })
  .handler(async ({ data, context }) => {
    try {
      const { simularAssinatura, simularCompraCreditos } = await import("@/lib/simulacao.server");
      const { pacotePorId } = await import("@/lib/planos");
      if (pacotePorId(data.priceId)) {
        const r = await simularCompraCreditos({
          userId: context.userId,
          priceId: data.priceId,
          forma: data.forma,
          env: data.environment,
        });
        return { tipo: "creditos" as const, ...r };
      }
      const r = await simularAssinatura({
        userId: context.userId,
        priceId: data.priceId,
        env: data.environment,
      });
      return { tipo: "assinatura" as const, ...r };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const simularRenovacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => ({
    environment: validarSandbox(data.environment),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { simularRenovacaoAssinatura } = await import("@/lib/simulacao.server");
      return await simularRenovacaoAssinatura({ userId: context.userId, env: data.environment });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const simularCancelamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => ({
    environment: validarSandbox(data.environment),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { simularCancelamentoAssinatura } = await import("@/lib/simulacao.server");
      return await simularCancelamentoAssinatura({ userId: context.userId, env: data.environment });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const listarCorridasSimulaveis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => ({
    environment: validarSandbox(data.environment),
  }))
  .handler(async ({ context }) => {
    const { corridasSimulaveis } = await import("@/lib/simulacao.server");
    return { corridas: await corridasSimulaveis(context.userId) };
  });

export const simularPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { corridaId: string; forma: string; usarCreditos?: boolean; environment: string }) => {
      if (!uuid.test(data.corridaId ?? "")) throw new Error("Corrida inválida.");
      return {
        corridaId: data.corridaId,
        forma: validarForma(data.forma),
        usarCreditos: Boolean(data.usarCreditos),
        environment: validarSandbox(data.environment),
      };
    },
  )
  .handler(async ({ data, context }) => {
    try {
      const { simularPagamentoCorrida } = await import("@/lib/simulacao.server");
      return await simularPagamentoCorrida({
        corridaId: data.corridaId,
        userId: context.userId,
        forma: data.forma,
        usarCreditos: data.usarCreditos,
        env: data.environment,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const limparDadosSimulados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => ({
    environment: validarSandbox(data.environment),
  }))
  .handler(async ({ data, context }) => {
    try {
      const { limparSimulacao } = await import("@/lib/simulacao.server");
      return await limparSimulacao({ userId: context.userId, env: data.environment });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
