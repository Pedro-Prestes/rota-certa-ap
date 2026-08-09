import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";

const validarAmbiente = (env: string): StripeEnv => {
  if (env !== "sandbox" && env !== "live") throw new Error("Ambiente de cobrança inválido.");
  return env;
};

/** Vagas restantes por estado — leitura pública para a página inicial. */
export const consultarVagasPromo = createServerFn({ method: "GET" }).handler(async () => {
  const { vagasRestantes } = await import("@/lib/promocao.server");
  return vagasRestantes();
});

/** Concede a cortesia de lançamento após a publicação da primeira rota. */
export const resgatarPromoDaRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string; uf: string; environment: StripeEnv }) => {
    if (!data.rotaId || data.rotaId.length > 64) throw new Error("Rota inválida.");
    if (!data.uf || data.uf.length !== 2) throw new Error("Estado inválido.");
    validarAmbiente(data.environment);
    return data;
  })
  .handler(async ({ data, context }) => {
    const { concederPromoPrimeiraRota } = await import("@/lib/promocao.server");
    return concederPromoPrimeiraRota({
      userId: context.userId,
      rotaId: data.rotaId,
      uf: data.uf,
      environment: data.environment,
    });
  });

/** Situação da cortesia do próprio usuário. */
export const consultarMinhaPromo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { promoDoUsuario } = await import("@/lib/promocao.server");
    return promoDoUsuario(context.userId);
  });

/** Painel administrativo: vagas por estado e premiados. */
export const consultarPainelPromo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: gestao } = await context.supabase.rpc("eh_gestao", { _user_id: context.userId });
    if (!gestao) throw new Error("Acesso restrito à gestão.");
    const { vagasRestantes, premiados } = await import("@/lib/promocao.server");
    const [vagas, lista] = await Promise.all([vagasRestantes(), premiados()]);
    return { ...vagas, premiados: lista };
  });

/** Liga/desliga a campanha promocional. */
export const alternarCampanhaPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ativa: boolean }) => ({ ativa: Boolean(data.ativa) }))
  .handler(async ({ data, context }) => {
    const { data: gestao } = await context.supabase.rpc("eh_gestao", { _user_id: context.userId });
    if (!gestao) throw new Error("Acesso restrito à gestão.");
    const { definirCampanhaAtiva } = await import("@/lib/promocao.server");
    return definirCampanhaAtiva(data.ativa);
  });
