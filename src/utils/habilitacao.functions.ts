import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarHabilitacao } from "@/lib/habilitacao.server";

export const enviarHabilitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      numero: string;
      categoria: string;
      ear: boolean;
      validade?: string;
      primeiraHabilitacao?: string;
    }) => {
      if (typeof data.numero !== "string" || !data.numero.trim()) {
        throw new Error("Informe o número da CNH.");
      }
      if (typeof data.categoria !== "string" || !data.categoria.trim()) {
        throw new Error("Informe a categoria da CNH.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      return await registrarHabilitacao({
        userId: context.userId,
        numero: data.numero,
        categoria: data.categoria,
        ear: !!data.ear,
        validade: data.validade ?? null,
        primeiraHabilitacao: data.primeiraHabilitacao ?? null,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
