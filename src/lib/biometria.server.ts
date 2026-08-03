import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { registrarEvento } from "./blockchain.server";
import { avaliarProvaVida, type PerfilBiometria, type ProvaVida } from "./biometria";

const BUCKET = "biometrias";
const MAX_BYTES = 4 * 1024 * 1024;

function decodificarJpeg(dataUrl: string): Uint8Array {
  const match = /^data:image\/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) throw new Error("Formato de imagem inválido.");
  const bytes = Buffer.from(match[2] as string, "base64");
  if (bytes.byteLength < 5_000) throw new Error("Imagem muito pequena para verificação.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Imagem maior que o limite de 4 MB.");
  return new Uint8Array(bytes);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function registrarBiometria(params: {
  userId: string;
  perfil: PerfilBiometria;
  imagem: string;
  provaVida: ProvaVida;
}) {
  const bytes = decodificarJpeg(params.imagem);
  const avaliacao = avaliarProvaVida(params.provaVida);
  const hash = await sha256(bytes);

  const path = `${params.userId}/${Date.now()}-${hash.slice(0, 12)}.jpg`;
  const upload = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (upload.error) throw new Error(`Falha ao guardar a selfie: ${upload.error.message}`);

  const { data: registro, error } = await supabaseAdmin
    .from("verificacoes_biometricas")
    .insert({
      user_id: params.userId,
      perfil: params.perfil,
      status: avaliacao.status,
      imagem_path: path,
      imagem_hash: hash,
      qualidade: avaliacao.qualidade,
      prova_vida: params.provaVida as unknown as Json,
      pendencias: avaliacao.pendencias,
      motivo: avaliacao.pendencias[0] ?? null,
      concluido_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // A imagem nunca entra na cadeia — só o seu hash, para prova de integridade.
  await registrarEvento({
    evento: "biometria_facial",
    registradoPor: params.userId,
    dados: {
      verificacao: registro.id,
      perfil: params.perfil,
      status: avaliacao.status,
      qualidade: avaliacao.qualidade,
      imagem_hash: hash,
      pendencias: avaliacao.pendencias,
    },
  });

  return {
    id: registro.id,
    status: avaliacao.status,
    qualidade: avaliacao.qualidade,
    pendencias: avaliacao.pendencias,
    hash,
  };
}

/** URL temporária da selfie, usada pelo próprio usuário ou pelo administrador. */
export async function urlSelfie(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
