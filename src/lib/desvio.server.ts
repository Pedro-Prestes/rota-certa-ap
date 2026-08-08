/**
 * Camada de infraestrutura da precificação por desvio.
 *
 * Usa a Routes API do Google através do gateway de conectores (nunca com
 * chave direta e nunca a Distance Matrix legada, removida do conector).
 * Falha do provedor degrada para o modo geodésico.
 */

import type { Coordenada } from "./embarque";
import {
  metricasGeometricas,
  precificarDesvio,
  type MetricasTrecho,
  type PrecoDesvio,
} from "./desvio";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function credenciais() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) return null;
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": maps,
  } satisfies Record<string, string>;
}

const segundos = (d: string | undefined) => Number((d ?? "0").replace("s", "")) || 0;

/** Distância/duração reais de um caminho origem → [intermediários] → destino. */
async function metricasRota(pontos: Coordenada[]): Promise<MetricasTrecho | null> {
  const headers = credenciais();
  if (!headers || pontos.length < 2) return null;
  const local = (c: Coordenada) => ({
    location: { latLng: { latitude: c.latitude, longitude: c.longitude } },
  });
  const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: local(pontos[0]!),
      destination: local(pontos[pontos.length - 1]!),
      intermediates: pontos.slice(1, -1).map(local),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });
  if (!res.ok) {
    console.error(`[routes] falha ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    routes?: Array<{ distanceMeters?: number; duration?: string }>;
  };
  const rota = json.routes?.[0];
  if (!rota) return null;
  return {
    distanciaKm: (rota.distanceMeters ?? 0) / 1000,
    duracaoMin: segundos(rota.duration) / 60,
  };
}

export interface EntradaPrecoAssento {
  origemMotorista: Coordenada;
  destinoMotorista: Coordenada;
  apanhePassageiro: Coordenada;
  precoBase: number;
  custoKmExtra?: number;
  custoMinExtra?: number;
}

/** Preço final do assento considerando o desvio até o ponto do passageiro. */
export async function calcularPrecoAssentoComDesvio(
  e: EntradaPrecoAssento,
): Promise<PrecoDesvio> {
  const caminhoDireto = [e.origemMotorista, e.destinoMotorista];
  const caminhoDesvio = [e.origemMotorista, e.apanhePassageiro, e.destinoMotorista];

  const [diretaReal, desvioReal] = await Promise.all([
    metricasRota(caminhoDireto),
    metricasRota(caminhoDesvio),
  ]);

  const usouProvedor = Boolean(diretaReal && desvioReal);
  const preco = precificarDesvio({
    direta: diretaReal ?? metricasGeometricas(caminhoDireto),
    comDesvio: desvioReal ?? metricasGeometricas(caminhoDesvio),
    precoBase: e.precoBase,
    ...(e.custoKmExtra !== undefined ? { custoKmExtra: e.custoKmExtra } : {}),
    ...(e.custoMinExtra !== undefined ? { custoMinExtra: e.custoMinExtra } : {}),
  });

  return {
    ...preco,
    metricas: { ...preco.metricas, provedor: usouProvedor ? "google_routes" : "geometrico" },
  };
}

/**
 * Estimativa do assento para o ponto que o passageiro está propondo em uma
 * rota já ofertada: geocodifica o endereço e mede o desvio real.
 */
export async function estimarPrecoPonto(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  rotaId: string,
  endereco: string,
) {
  const { geocodificar, coordenadaLocalidade } = await import("./embarque.server");
  const { data: rota, error } = await supabase
    .from("rotas")
    .select("origem, destino, uf_origem, uf_destino, preco_assento")
    .eq("id", rotaId)
    .single();
  if (error || !rota) throw new Error("Rota não encontrada.");

  const [origem, destino, apanhe] = await Promise.all([
    coordenadaLocalidade(rota.origem, rota.uf_origem),
    coordenadaLocalidade(rota.destino, rota.uf_destino),
    geocodificar(endereco, rota.uf_origem),
  ]);


  const preco = await calcularPrecoAssentoComDesvio({
    origemMotorista: origem,
    destinoMotorista: destino,
    apanhePassageiro: { latitude: apanhe.latitude, longitude: apanhe.longitude },
    precoBase: Number(rota.preco_assento ?? 0),
  });

  return { ...preco, enderecoFormatado: apanhe.enderecoFormatado };
}
