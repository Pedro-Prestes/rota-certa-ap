import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const perfil = z.enum(["passageiro", "motorista"]);
const tipo = z.enum(["documento_frente", "documento_verso", "selfie_documento", "cnh_frente", "cnh_verso"]);
const uuid = z.string().uuid();
const motivo = z.string().trim().min(10).max(500);

export const enviarDocumentoCredenciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    perfil,
    tipo,
    nome: z.string().trim().min(1).max(180),
    mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    conteudo: z.string().min(100).max(12_000_000),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { salvarDocumentoCredenciamento } = await import("@/lib/credenciamento-documentos.server");
    try {
      return await salvarDocumentoCredenciamento({ ...data, userId: context.userId });
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

export const abrirDocumentoCredenciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data, context }) => {
    const { obterUrlDocumento } = await import("@/lib/credenciamento-documentos.server");
    try {
      return { url: await obterUrlDocumento(context.userId, data.id) };
    } catch (error) {
      return { error: (error as Error).message };
    }
  });

export const listarCredenciamentosAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().max(120).default("") }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { listarCredenciamentos } = await import("@/lib/credenciamento-documentos.server");
    try {
      return { cadastros: await listarCredenciamentos(context.userId, data.termo) };
    } catch (error) {
      return { cadastros: [], error: (error as Error).message };
    }
  });

export const decidirCredenciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    userId: uuid,
    perfil,
    etapa: z.enum(["biometria", "documentos", "cnh", "veiculo", "total"]),
    acao: z.enum(["aprovar", "correcao", "rejeitar", "excluir", "reiniciar"]),
    motivo,
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { aplicarDecisaoCredenciamento } = await import("@/lib/credenciamento-documentos.server");
    try {
      return await aplicarDecisaoCredenciamento({ ...data, adminId: context.userId });
    } catch (error) {
      return { error: (error as Error).message };
    }
  });
