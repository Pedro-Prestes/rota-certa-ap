import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarBiometria, urlSelfie } from "@/lib/biometria.server";
import type { PerfilBiometria, ProvaVida } from "@/lib/biometria";

export const enviarBiometriaFacial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { perfil: PerfilBiometria; imagem: string; provaVida: ProvaVida }) => {
    if (data.perfil !== "passageiro" && data.perfil !== "motorista") {
      throw new Error("Perfil inválido.");
    }
    if (typeof data.imagem !== "string" || !data.imagem.startsWith("data:image/")) {
      throw new Error("Selfie inválida.");
    }
    if (!data.provaVida || typeof data.provaVida !== "object") {
      throw new Error("Dados da prova de vida ausentes.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      return await registrarBiometria({
        userId: context.userId,
        perfil: data.perfil,
        imagem: data.imagem,
        provaVida: data.provaVida,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const verSelfieBiometria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.id)) throw new Error("Verificação inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    // A leitura passa pelo cliente do usuário: o RLS garante que ele só veja as
    // próprias verificações (ou todas, se for administrador).
    const { data: registro, error } = await context.supabase
      .from("verificacoes_biometricas")
      .select("imagem_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!registro?.imagem_path) return { error: "Selfie não encontrada." };
    try {
      return { url: await urlSelfie(registro.imagem_path) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
