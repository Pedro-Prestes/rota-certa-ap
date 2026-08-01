import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";

/**
 * Registra na cadeia um evento de corrida, garantindo que quem grava é o dono
 * da corrida ou um administrador.
 */
export async function registrarEventoCorrida(params: {
  evento: string;
  corridaId: string;
  userId: string;
  dados: Record<string, unknown>;
}) {
  const { data: corrida, error } = await supabaseAdmin
    .from("corridas")
    .select("id, user_id, origem, destino, distancia_km, data_corrida")
    .eq("id", params.corridaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!corrida) throw new Error("Corrida não encontrada.");

  if (corrida.user_id !== params.userId) {
    const { data: admin } = await supabaseAdmin.rpc("has_role", {
      _user_id: params.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Sem permissão para registrar eventos desta corrida.");
  }

  const bloco = await registrarEvento({
    evento: params.evento,
    corridaId: corrida.id,
    registradoPor: params.userId,
    dados: {
      origem: corrida.origem,
      destino: corrida.destino,
      distancia_km: corrida.distancia_km,
      data_corrida: corrida.data_corrida,
      ...params.dados,
    },
  });

  if (!bloco) throw new Error("Não foi possível registrar o bloco.");
  return bloco;
}
