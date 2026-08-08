import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { medirTrecho } from "@/lib/embarque.server";
import { normalizarUf } from "@/lib/ufs";

/**
 * Mede o trecho A → B (km e minutos) pela malha viária real no momento do
 * cadastramento da rota do motorista, em qualquer estado brasileiro.
 */
export const medirTrechoRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origem: string; destino: string; ufOrigem?: string; ufDestino?: string }) => {
    const origem = data.origem?.trim() ?? "";
    const destino = data.destino?.trim() ?? "";
    if (origem.length < 3 || destino.length < 3) throw new Error("Informe origem e destino.");
    if (origem.length > 120 || destino.length > 120) throw new Error("Localidade inválida.");
    const ufOrigem = normalizarUf(data.ufOrigem);
    const ufDestino = normalizarUf(data.ufDestino);
    if (data.ufOrigem && !ufOrigem) throw new Error("Estado de origem inválido.");
    if (data.ufDestino && !ufDestino) throw new Error("Estado de destino inválido.");
    if (origem.toLowerCase() === destino.toLowerCase() && ufOrigem === ufDestino) {
      throw new Error("Origem e destino precisam ser diferentes.");
    }
    return { origem, destino, ufOrigem, ufDestino };
  })
  .handler(async ({ data }) => {
    try {
      return await medirTrecho(data.origem, data.destino, data.ufOrigem, data.ufDestino);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
