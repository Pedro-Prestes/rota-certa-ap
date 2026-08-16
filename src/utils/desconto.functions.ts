import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Descontos vigentes das rotas exibidas ao passageiro (leitura pública). */
export const descontosDasRotas = createServerFn({ method: "POST" })
  .inputValidator((data: { rotaIds: string[] }) => {
    const ids = (data.rotaIds ?? []).filter((id) => /^[0-9a-fA-F-]{36}$/.test(id)).slice(0, 60);
    return { rotaIds: ids };
  })
  .handler(async ({ data }) => {
    const { descontosVigentesDeRotas } = await import("@/lib/descontos.server");
    try {
      return { descontos: await descontosVigentesDeRotas(data.rotaIds) };
    } catch {
      return { descontos: [] };
    }
  });

/** Histórico de descontos de uma rota (painel do motorista/frotista). */
export const descontosDaMinhaRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Rota inválida.");
    return data;
  })
  .handler(async ({ data }) => {
    const { descontosDaRota } = await import("@/lib/descontos.server");
    try {
      return { descontos: await descontosDaRota(data.rotaId) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível ler os descontos." };
    }
  });

/** Publica o desconto promocional da rota e avisa os passageiros. */
export const definirDescontoRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      rotaId: string;
      percentual: number;
      trecho?: "ida" | "volta" | "ambos";
      fim?: string | null;
      observacao?: string | null;
    }) => {
      if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Rota inválida.");
      const percentual = Math.round(Number(data.percentual));
      if (!Number.isFinite(percentual) || percentual < 1 || percentual > 25) {
        throw new Error("Informe um desconto de 1% a 25%.");
      }
      const trecho = data.trecho ?? "ambos";
      if (!["ida", "volta", "ambos"].includes(trecho)) throw new Error("Trecho inválido.");
      const obs = (data.observacao ?? "").trim().slice(0, 200);
      return {
        rotaId: data.rotaId,
        percentual,
        trecho,
        fim: data.fim ?? null,
        observacao: obs || null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { publicarDesconto } = await import("@/lib/descontos.server");
    try {
      return await publicarDesconto({ ...data, userId: context.userId });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível publicar o desconto." };
    }
  });

/** Encerra o desconto vigente da rota. */
export const encerrarDescontoRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Rota inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { encerrarDesconto } = await import("@/lib/descontos.server");
    try {
      return await encerrarDesconto(context.userId, data.rotaId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível encerrar o desconto." };
    }
  });
