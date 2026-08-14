import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntradaDocumentoPJ, TipoEntidadePJ } from "@/lib/credenciamento-pj";

const tipoValido = (t: unknown): TipoEntidadePJ => {
  if (t !== "cooperativa" && t !== "frotista") throw new Error("Tipo de entidade inválido.");
  return t;
};

/** Painel de credenciamento em 3 fases da empresa (cooperativa ou frotista). */
export const painelCredenciamentoPJ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo: TipoEntidadePJ }) => ({ tipo: tipoValido(data?.tipo) }))
  .handler(async ({ data, context }) => {
    const { painelCredenciamentoPJ: painel } = await import("@/lib/credenciamento-pj.server");
    return painel(data.tipo, context.userId);
  });

/** Envia um documento de conformidade da empresa para avaliação automática. */
export const enviarDocumentoPJ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tipo: TipoEntidadePJ; entrada: EntradaDocumentoPJ }) => {
    const tipo = tipoValido(data?.tipo);
    if (!data?.entrada?.tipo_documento) throw new Error("Informe o tipo de documento.");
    return { tipo, entrada: data.entrada };
  })
  .handler(async ({ data, context }) => {
    const { enviarDocumentoPJ: enviar } = await import("@/lib/credenciamento-pj.server");
    try {
      const r = await enviar({ tipo: data.tipo, userId: context.userId, entrada: data.entrada });
      return { avaliacao: r.avaliacao, situacao: r.situacao };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível enviar o documento." };
    }
  });

/** Semáforo de conformidade dos condutores vinculados à cooperativa. */
export const conformidadeCondutoresCooperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cooperativaId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data?.cooperativaId ?? "")) {
      throw new Error("Cooperativa inválida.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { cooperativaDoResponsavel } = await import("@/lib/cooperativa.server");
    const { conformidadeMotoristasCooperativa } = await import("@/lib/credenciamento-pj.server");
    const coop = await cooperativaDoResponsavel(context.userId);
    if (!coop || coop.id !== data.cooperativaId) return { condutores: [] };
    return { condutores: await conformidadeMotoristasCooperativa(data.cooperativaId) };
  });
