import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { medirTrecho } from "@/lib/embarque.server";

/**
 * Mede o trecho A → B (km e minutos) pela malha viária real no momento do
 * cadastramento da rota do motorista.
 */
export const medirTrechoRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origem: string; destino: string }) => {
    const origem = data.origem?.trim() ?? "";
    const destino = data.destino?.trim() ?? "";
    if (origem.length < 3 || destino.length < 3) throw new Error("Informe origem e destino.");
    if (origem.length > 120 || destino.length > 120) throw new Error("Localidade inválida.");
    if (origem.toLowerCase() === destino.toLowerCase()) {
      throw new Error("Origem e destino precisam ser diferentes.");
    }
    return { origem, destino };
  })
  .handler(async ({ data }) => {
    try {
      return await medirTrecho(data.origem, data.destino);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
