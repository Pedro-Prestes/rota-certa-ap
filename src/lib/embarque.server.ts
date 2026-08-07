import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL } from "./dados";
import {
  distanciaKm,
  matrizGeometrica,
  planejarBusca,
  type Coordenada,
  type Matriz,
  type PlanoBusca,
  type PontoBusca,
} from "./embarque";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

type Cliente = SupabaseClient<Database>;

function credenciais() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) return null;
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": maps,
  } satisfies Record<string, string>;
}

async function erroGateway(res: Response): Promise<never> {
  const corpo = await res.text();
  console.error(`[maps] falha ${res.status}: ${corpo}`);
  throw new Error(`Serviço de georreferenciamento indisponível (${res.status}).`);
}

/** Geocodificação de endereço livre (ponto de embarque combinado). */
export async function geocodificar(
  endereco: string,
): Promise<{ latitude: number; longitude: number; enderecoFormatado: string }> {
  const headers = credenciais();
  if (!headers) throw new Error("Georreferenciamento não configurado.");
  const consulta = encodeURIComponent(`${endereco}, Amapá, Brasil`);
  const res = await fetch(`${GATEWAY}/maps/api/geocode/json?address=${consulta}&region=br`, {
    headers,
  });
  if (!res.ok) await erroGateway(res);
  const json = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };
  const primeiro = json.results?.[0];
  if (json.status !== "OK" || !primeiro) {
    throw new Error("Endereço não localizado. Detalhe rua, número e bairro.");
  }
  return {
    latitude: primeiro.geometry.location.lat,
    longitude: primeiro.geometry.location.lng,
    enderecoFormatado: primeiro.formatted_address,
  };
}

const cacheLocalidade = new Map<string, Coordenada>();

export async function coordenadaLocalidade(nome: string): Promise<Coordenada> {
  const chave = nome.toLowerCase();
  const cache = cacheLocalidade.get(chave);
  if (cache) return cache;
  const { latitude, longitude } = await geocodificar(nome.replace(/\s*\(sede\)/i, ""));
  const coord = { latitude, longitude };
  cacheLocalidade.set(chave, coord);
  return coord;
}

/**
 * Ponto de saída da cidade: projeção a 6 km da sede de origem no rumo do
 * destino — é onde a rota de busca termina e a viagem programada começa.
 */
export function pontoSaidaCidade(origem: Coordenada, destino: Coordenada): Coordenada {
  const total = Math.max(0.5, distanciaKm(origem, destino));
  const t = Math.min(0.5, 6 / total);
  return {
    latitude: origem.latitude + (destino.latitude - origem.latitude) * t,
    longitude: origem.longitude + (destino.longitude - origem.longitude) * t,
  };
}

interface RespostaRotas {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    optimizedIntermediateWaypointIndex?: number[];
    legs?: Array<{ distanceMeters?: number; duration?: string }>;
  }>;
}

const segundos = (d: string | undefined) => Number((d ?? "0").replace("s", "")) || 0;

/**
 * Rota otimizada real (Google Routes API) com reordenação dos pontos de
 * embarque. Retorna a ordem e uma matriz preenchida nos trechos usados.
 */
async function rotaOtimizada(
  base: Coordenada,
  pontos: Coordenada[],
  saida: Coordenada,
): Promise<{ ordem: number[]; matriz: Matriz } | null> {
  const headers = credenciais();
  if (!headers || pontos.length === 0) return null;
  const local = (c: Coordenada) => ({
    location: { latLng: { latitude: c.latitude, longitude: c.longitude } },
  });
  const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration",
    },
    body: JSON.stringify({
      origin: local(base),
      destination: local(saida),
      intermediates: pontos.map(local),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: pontos.length > 1,
    }),
  });
  if (!res.ok) {
    const corpo = await res.text();
    console.error(`[routes] falha ${res.status}: ${corpo}`);
    return null;
  }
  const json = (await res.json()) as RespostaRotas;
  const rota = json.routes?.[0];
  if (!rota?.legs || rota.legs.length !== pontos.length + 1) return null;

  const ordem =
    rota.optimizedIntermediateWaypointIndex ?? pontos.map((_, i) => i);
  const n = pontos.length + 2;
  const km: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const min: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const seq = [0, ...ordem.map((i) => i + 1), n - 1];
  rota.legs.forEach((leg, i) => {
    const de = seq[i]!;
    const para = seq[i + 1]!;
    km[de]![para] = (leg.distanceMeters ?? 0) / 1000;
    min[de]![para] = segundos(leg.duration) / 60;
  });
  return { ordem, matriz: { km, min } };
}

export interface ResultadoPlano extends PlanoBusca {
  rotaId: string;
  dataViagem: string;
  pontosAcordados: number;
}

/**
 * Recalcula e persiste o plano de embarque de uma rota em uma data, usando
 * apenas os pontos com acordo fechado (status "aceito").
 */
export async function replanejarEmbarque(
  supabase: Cliente,
  rotaId: string,
  dataViagem: string,
): Promise<ResultadoPlano> {
  const { data: rota, error: erroRota } = await supabase
    .from("rotas")
    .select("id, origem, destino, saida_ida")
    .eq("id", rotaId)
    .single();
  if (erroRota || !rota) throw new Error("Rota não encontrada.");

  const { data: pontos, error: erroPontos } = await supabase
    .from("pontos_embarque")
    .select("id, passageiro_nome, endereco, latitude, longitude, assentos, status")
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem)
    .eq("status", "aceito");
  if (erroPontos) throw erroPontos;

  const origem = await coordenadaLocalidade(rota.origem);
  const destino = await coordenadaLocalidade(rota.destino);
  const saidaCidade = pontoSaidaCidade(origem, destino);

  const lista: PontoBusca[] = (pontos ?? []).map((p) => ({
    id: p.id,
    rotulo: `${p.passageiro_nome || "Passageiro"} — ${p.endereco}`,
    assentos: p.assentos,
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
  }));

  const partida = new Date(`${dataViagem}T${(rota.saida_ida ?? "06:00").slice(0, 5)}:00-03:00`);

  const externo = await rotaOtimizada(origem, lista, saidaCidade);
  const plano = planejarBusca({
    base: origem,
    saidaCidade,
    pontos: lista,
    partida,
    precoCombustivel: PRECO_COMBUSTIVEL,
    consumoKmL: CONSUMO_KM_L,
    matriz: externo?.matriz ?? matrizGeometrica([origem, ...lista, saidaCidade]),
    ...(externo ? { ordemProvedor: externo.ordem, provedor: "google_routes" } : {}),
  });

  const { error: erroPlano } = await supabase.from("planos_embarque").upsert(
    {
      rota_id: rotaId,
      data_viagem: dataViagem,
      distancia_busca_km: plano.distanciaKm,
      duracao_busca_min: plano.duracaoMin,
      custo_busca: plano.custo,
      saida_motorista: plano.saidaMotorista,
      partida_garantida: plano.partidaGarantida,
      sequencia: plano.paradas as unknown as Json,
      provedor: plano.provedor,
    },
    { onConflict: "rota_id,data_viagem" },
  );
  if (erroPlano) throw erroPlano;

  for (const parada of plano.paradas) {
    const { error } = await supabase
      .from("pontos_embarque")
      .update({
        ordem: parada.ordem,
        eta_ponto: parada.eta,
        saida_motorista: plano.saidaMotorista,
      })
      .eq("id", parada.pontoId);
    if (error) throw error;
  }

  return { ...plano, rotaId, dataViagem, pontosAcordados: lista.length };
}
