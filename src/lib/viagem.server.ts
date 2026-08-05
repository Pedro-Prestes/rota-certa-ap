import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import type { StripeEnv } from "./stripe.server";
import { distanciaPercorrida } from "./rastreio";

/**
 * Fecha a viagem: consolida a distância realmente percorrida a partir das
 * posições transmitidas e grava um bloco de auditoria com o resultado.
 */
export async function finalizarViagem(params: {
  viagemId: string;
  motoristaId: string;
  env: StripeEnv;
}) {
  const { data: viagem, error } = await supabaseAdmin
    .from("viagens")
    .select("*")
    .eq("id", params.viagemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!viagem) throw new Error("Viagem não encontrada.");
  if (viagem.motorista_id !== params.motoristaId) {
    throw new Error("Somente o motorista da viagem pode encerrá-la.");
  }

  const { data: posicoes } = await supabaseAdmin
    .from("viagem_posicoes")
    .select("latitude, longitude, registrado_em")
    .eq("viagem_id", params.viagemId)
    .order("sequencia", { ascending: true });

  const km = distanciaPercorrida(
    (posicoes ?? []).map((p) => ({
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      registrado_em: p.registrado_em,
    })),
  );

  const concluida_em = new Date().toISOString();
  const { data: fechada, error: erroUpdate } = await supabaseAdmin
    .from("viagens")
    .update({ status: "concluida", concluida_em, distancia_percorrida_km: km })
    .eq("id", params.viagemId)
    .select("*")
    .single();
  if (erroUpdate) throw new Error(erroUpdate.message);

  await registrarEvento({
    evento: "viagem_concluida",
    registradoPor: params.motoristaId,
    dados: {
      viagem_id: params.viagemId,
      rota_id: viagem.rota_id,
      data_viagem: viagem.data_viagem,
      veiculo_id: viagem.veiculo_id,
      iniciada_em: viagem.iniciada_em,
      concluida_em,
      distancia_km: km,
      pontos_transmitidos: posicoes?.length ?? 0,
      ambiente: params.env,
    },
  });

  return { viagem: fechada, distanciaKm: km, pontos: posicoes?.length ?? 0 };
}
