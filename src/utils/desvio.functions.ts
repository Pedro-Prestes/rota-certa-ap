import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularPrecoAssentoComDesvio } from "@/lib/desvio.server";

interface Coord {
  latitude: number;
  longitude: number;
}

const coord = (c: Coord | undefined, nome: string): Coord => {
  const lat = Number(c?.latitude);
  const lng = Number(c?.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`Latitude inválida (${nome}).`);
  if (!Number.isFinite(lng) || lng < -180 || lng > 180)
    throw new Error(`Longitude inválida (${nome}).`);
  return { latitude: lat, longitude: lng };
};

/** Preço do assento calculado pelo desvio real gerado pelo ponto de apanhe. */
export const precoAssentoComDesvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      origemMotorista: Coord;
      destinoMotorista: Coord;
      apanhePassageiro: Coord;
      precoBase: number;
      custoKmExtra?: number;
      custoMinExtra?: number;
    }) => {
      const precoBase = Number(data.precoBase);
      if (!Number.isFinite(precoBase) || precoBase < 0 || precoBase > 100_000)
        throw new Error("Preço base inválido.");
      return {
        origemMotorista: coord(data.origemMotorista, "origem"),
        destinoMotorista: coord(data.destinoMotorista, "destino"),
        apanhePassageiro: coord(data.apanhePassageiro, "ponto de apanhe"),
        precoBase,
        ...(data.custoKmExtra !== undefined ? { custoKmExtra: Number(data.custoKmExtra) } : {}),
        ...(data.custoMinExtra !== undefined ? { custoMinExtra: Number(data.custoMinExtra) } : {}),
      };
    },
  )
  .handler(async ({ data }) => {
    try {
      return await calcularPrecoAssentoComDesvio(data);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
