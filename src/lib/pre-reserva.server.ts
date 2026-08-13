/**
 * Apoio de servidor da pré-reserva: geocodifica o endereço de embarque na UF
 * de origem da saída escolhida, para que a rota de busca do fechamento já
 * tenha coordenadas confiáveis.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function localizarEmbarque(rotaId: string, endereco: string) {
  const { data: rota } = await supabaseAdmin
    .from("rotas")
    .select("uf_origem, status")
    .eq("id", rotaId)
    .maybeSingle();
  if (!rota) throw new Error("Saída não encontrada.");
  if (rota.status !== "ativa") throw new Error("Esta saída não está mais disponível.");

  const { geocodificar } = await import("./embarque.server");
  const local = await geocodificar(endereco, rota.uf_origem);
  return {
    enderecoFormatado: local.enderecoFormatado,
    latitude: local.latitude,
    longitude: local.longitude,
  };
}
