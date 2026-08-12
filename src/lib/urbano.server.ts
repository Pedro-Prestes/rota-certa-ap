/**
 * Modo urbano — camada de servidor.
 *
 * Fluxo espelhado nas plataformas de mobilidade urbana: o motorista liga a
 * chave de conversão, escolhe o município-base e fica online; o passageiro
 * informa origem/destino, vê o preço antes de pedir e recebe o aceite do
 * primeiro motorista disponível (pedido imediato) ou confirma um agendamento.
 *
 * A tarifação é dinâmica (bandeirada + km + minuto, com fator de pico) e a
 * taxa administrativa é rateada com a cooperativa do motorista no instante em
 * que a corrida é concluída e paga.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { carregarConfig, configDoUsuario } from "./cobranca.server";
import { comporCobranca } from "./taxas";
import { comporGanhoViagem } from "./carteira-motorista";
import { registrarEvento } from "./blockchain.server";
import { creditarRateioCooperativa } from "./cooperativa.server";
import {
  CANCELAMENTO_COM_CUSTO,
  RAIO_DESPACHO_KM,
  TARIFA_URBANA_PADRAO,
  distanciaKm,
  emHorarioDePico,
  precificarCorridaUrbana,
  proximaEtapa,
  type StatusCorridaUrbana,
  type TarifaUrbana,
} from "./urbano";

const n = (v: unknown) => Number(v ?? 0) || 0;
const arred = (v: number) => Math.round(v * 100) / 100;

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function credenciais() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) return null;
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps };
}

/** Distância e duração reais do trecho, com degradação geodésica. */
async function metricasTrecho(
  origem: { latitude: number; longitude: number },
  destino: { latitude: number; longitude: number },
): Promise<{ distanciaKm: number; duracaoMin: number; provedor: string }> {
  const headers = credenciais();
  if (headers) {
    try {
      const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origem.latitude, longitude: origem.longitude } } },
          destination: {
            location: { latLng: { latitude: destino.latitude, longitude: destino.longitude } },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          routes?: Array<{ distanceMeters?: number; duration?: string }>;
        };
        const rota = json.routes?.[0];
        if (rota) {
          return {
            distanciaKm: arred((rota.distanceMeters ?? 0) / 1000),
            duracaoMin: Math.round(Number((rota.duration ?? "0s").replace("s", "")) / 60),
            provedor: "google_routes",
          };
        }
      } else {
        console.error(`[urbano] rotas falhou ${res.status}`);
      }
    } catch (e) {
      console.error("[urbano] falha ao consultar rotas", e);
    }
  }
  const km = distanciaKm(origem, destino) * 1.25;
  return { distanciaKm: arred(km), duracaoMin: Math.max(5, Math.round((km / 28) * 60)), provedor: "geometrico" };
}

/* ------------------------------------------------------------------- tarifas */

export async function tarifaDoMunicipio(municipio: string, uf: string): Promise<TarifaUrbana> {
  const { data } = await supabaseAdmin
    .from("tarifas_urbanas")
    .select("*")
    .eq("uf", uf.toUpperCase())
    .eq("municipio", municipio)
    .eq("ativa", true)
    .maybeSingle();
  if (data) {
    return {
      id: data.id,
      municipio: data.municipio,
      uf: data.uf,
      bandeirada: n(data.bandeirada),
      valor_km: n(data.valor_km),
      valor_minuto: n(data.valor_minuto),
      minimo: n(data.minimo),
      fator_pico: n(data.fator_pico) || 1,
      taxa_cancelamento: n(data.taxa_cancelamento),
      ativa: true,
    };
  }
  return { municipio, uf: uf.toUpperCase(), ...TARIFA_URBANA_PADRAO };
}

/* -------------------------------------------- chave de conversão do motorista */

export async function estadoUrbanoMotorista(userId: string) {
  const { data } = await supabaseAdmin
    .from("motoristas_urbanos")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function converterModoUrbano(params: {
  userId: string;
  ativo: boolean;
  municipio?: string | null;
  uf?: string | null;
}) {
  if (params.ativo && (!params.municipio || !params.uf)) {
    throw new Error("Escolha o município-base para operar no modo urbano.");
  }
  const { data, error } = await supabaseAdmin
    .from("motoristas_urbanos")
    .upsert(
      {
        user_id: params.userId,
        ativo: params.ativo,
        ...(params.ativo ? {} : { online: false }),
        municipio: params.municipio ?? null,
        uf: params.uf ? params.uf.toUpperCase() : null,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function definirDisponibilidade(params: {
  userId: string;
  online: boolean;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const atual = await estadoUrbanoMotorista(params.userId);
  if (!atual?.ativo) throw new Error("Ligue a chave do modo urbano antes de ficar online.");
  const { data, error } = await supabaseAdmin
    .from("motoristas_urbanos")
    .update({
      online: params.online,
      ultima_latitude: params.latitude ?? atual.ultima_latitude,
      ultima_longitude: params.longitude ?? atual.ultima_longitude,
      ultima_posicao_em: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/* ---------------------------------------------------------------- estimativa */

export interface EntradaEstimativa {
  userId: string;
  municipio: string;
  uf: string;
  origem: string;
  destino: string;
  environment?: "sandbox" | "live";
}

export async function estimarCorridaUrbana(e: EntradaEstimativa) {
  const { geocodificar } = await import("./embarque.server");
  const [origem, destino] = await Promise.all([
    geocodificar(e.origem, e.uf),
    geocodificar(e.destino, e.uf),
  ]);

  const [tarifa, metricas] = await Promise.all([
    tarifaDoMunicipio(e.municipio, e.uf),
    metricasTrecho(origem, destino),
  ]);

  const pico = emHorarioDePico();
  const preco = precificarCorridaUrbana({
    tarifa,
    distanciaKm: metricas.distanciaKm,
    duracaoMin: metricas.duracaoMin,
    pico,
  });

  const cfg = await configDoUsuario(e.userId, e.environment ?? "live");
  const composicao = comporCobranca(preco.base, cfg);

  return {
    tarifa,
    pico,
    provedor: metricas.provedor,
    origem: { ...origem },
    destino: { ...destino },
    preco,
    composicao,
    taxaCancelamento: tarifa.taxa_cancelamento,
  };
}

/* ------------------------------------------------------------------- corridas */

export interface EntradaCorridaUrbana extends EntradaEstimativa {
  modo: "imediato" | "agendado";
  agendadaPara?: string | null;
  formaPagamento: "pix" | "credito" | "debito" | "dinheiro";
}

export async function solicitarCorridaUrbana(e: EntradaCorridaUrbana) {
  if (e.modo === "agendado" && !e.agendadaPara) {
    throw new Error("Informe a data e a hora do agendamento.");
  }
  const estimativa = await estimarCorridaUrbana(e);

  const { data, error } = await supabaseAdmin
    .from("corridas_urbanas")
    .insert({
      passageiro_id: e.userId,
      modo: e.modo,
      municipio: e.municipio,
      uf: e.uf.toUpperCase(),
      origem_endereco: estimativa.origem.enderecoFormatado || e.origem,
      origem_latitude: estimativa.origem.latitude,
      origem_longitude: estimativa.origem.longitude,
      destino_endereco: estimativa.destino.enderecoFormatado || e.destino,
      destino_latitude: estimativa.destino.latitude,
      destino_longitude: estimativa.destino.longitude,
      distancia_km: estimativa.preco.distanciaKm,
      duracao_min: estimativa.preco.duracaoMin,
      agendada_para: e.agendadaPara ?? null,
      bandeirada: estimativa.preco.bandeirada,
      valor_km: estimativa.preco.valorKm,
      valor_minuto: estimativa.preco.valorMinuto,
      fator_pico: estimativa.preco.fatorAplicado,
      base: estimativa.preco.base,
      taxa_administrativa: estimativa.composicao.taxaAdministrativa,
      total: estimativa.composicao.total,
      forma_pagamento: e.formaPagamento,
      taxa_cancelamento: estimativa.taxaCancelamento,
      status: "ofertada",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await registrarEvento({
    evento: "corrida_urbana_solicitada",
    registradoPor: e.userId,
    dados: {
      corrida_urbana_id: data.id,
      municipio: e.municipio,
      uf: e.uf,
      modo: e.modo,
      distancia_km: data.distancia_km,
      total: data.total,
    },
  }).catch((erro) => console.error("[urbano] bloco não registrado", erro));

  return { corrida: data, estimativa };
}

/** Ofertas visíveis ao motorista urbano, ordenadas por proximidade. */
export async function ofertasDoMotorista(userId: string) {
  const estado = await estadoUrbanoMotorista(userId);
  if (!estado?.ativo || !estado.municipio || !estado.uf) return { estado, ofertas: [], minhas: [] };

  const [abertas, minhas] = await Promise.all([
    supabaseAdmin
      .from("corridas_urbanas")
      .select("*")
      .eq("status", "ofertada")
      .eq("uf", estado.uf)
      .eq("municipio", estado.municipio)
      .order("created_at", { ascending: true })
      .limit(30),
    supabaseAdmin
      .from("corridas_urbanas")
      .select("*")
      .eq("motorista_id", userId)
      .in("status", ["aceita", "a_caminho", "aguardando", "em_viagem"])
      .order("created_at", { ascending: false }),
  ]);

  const pos =
    estado.ultima_latitude != null && estado.ultima_longitude != null
      ? { latitude: n(estado.ultima_latitude), longitude: n(estado.ultima_longitude) }
      : null;

  const ofertas = (abertas.data ?? [])
    .map((c) => ({
      ...c,
      distanciaAteEmbarqueKm: pos
        ? distanciaKm(pos, { latitude: n(c.origem_latitude), longitude: n(c.origem_longitude) })
        : null,
    }))
    .filter((c) => c.distanciaAteEmbarqueKm == null || c.distanciaAteEmbarqueKm <= RAIO_DESPACHO_KM)
    .sort((a, b) => (a.distanciaAteEmbarqueKm ?? 999) - (b.distanciaAteEmbarqueKm ?? 999));

  return { estado, ofertas, minhas: minhas.data ?? [] };
}

export async function aceitarCorridaUrbana(params: { userId: string; corridaId: string }) {
  const estado = await estadoUrbanoMotorista(params.userId);
  if (!estado?.ativo) throw new Error("Ative o modo urbano para aceitar corridas.");

  const { cooperativaDoMotorista } = await import("./cooperativa.server");
  const cooperativaId = await cooperativaDoMotorista(params.userId);

  // Primeiro a aceitar leva: a condição de status garante a exclusividade.
  const { data, error } = await supabaseAdmin
    .from("corridas_urbanas")
    .update({
      motorista_id: params.userId,
      cooperativa_id: cooperativaId,
      status: "aceita",
      aceita_em: new Date().toISOString(),
    })
    .eq("id", params.corridaId)
    .eq("status", "ofertada")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Esta corrida já foi aceita por outro motorista.");
  return data;
}

async function corridaDoMotorista(corridaId: string, motoristaId: string) {
  const { data } = await supabaseAdmin
    .from("corridas_urbanas")
    .select("*")
    .eq("id", corridaId)
    .eq("motorista_id", motoristaId)
    .maybeSingle();
  if (!data) throw new Error("Corrida não encontrada.");
  return data;
}

export async function avancarEtapaUrbana(params: { userId: string; corridaId: string }) {
  const corrida = await corridaDoMotorista(params.corridaId, params.userId);
  const proxima = proximaEtapa(corrida.status);
  if (!proxima) throw new Error("A corrida já está encerrada.");

  const agora = new Date().toISOString();
  const patch = {
    status: proxima as string,
    ...(proxima === "em_viagem" ? { iniciada_em: agora } : {}),
    ...(proxima === "concluida" ? { concluida_em: agora } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("corridas_urbanas")
    .update(patch)
    .eq("id", params.corridaId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (proxima === "concluida") await liquidarCorridaUrbana(data);
  return data;
}

/**
 * Concluída a corrida: credita o líquido do motorista, retém a taxa
 * administrativa e rateia a parcela da cooperativa no mesmo instante.
 */
async function liquidarCorridaUrbana(corrida: Record<string, unknown>) {
  const corridaId = String(corrida["id"]);
  const motoristaId = corrida["motorista_id"] ? String(corrida["motorista_id"]) : null;
  if (!motoristaId) return;

  const base = n(corrida["base"]);
  const taxa = n(corrida["taxa_administrativa"]);
  const trecho = `${corrida["origem_endereco"]} → ${corrida["destino_endereco"]}`;
  const cfg = await carregarConfig();
  const ganho = comporGanhoViagem(base, cfg.repasse_motorista_percentual);

  const { data: existente } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("driver_id", motoristaId)
    .eq("type", "RIDE_EARNING")
    .eq("description", `Corrida urbana ${trecho} (${corridaId.slice(0, 8)})`)
    .maybeSingle();

  if (!existente) {
    await supabaseAdmin
      .from("driver_wallet")
      .upsert({ driver_id: motoristaId }, { onConflict: "driver_id", ignoreDuplicates: true });
    await supabaseAdmin.from("wallet_transactions").insert([
      {
        driver_id: motoristaId,
        type: "RIDE_EARNING" as const,
        amount: ganho.total,
        status: "COMPLETED" as const,
        description: `Corrida urbana ${trecho} (${corridaId.slice(0, 8)})`,
      },
      {
        driver_id: motoristaId,
        type: "PLATFORM_FEE" as const,
        amount: -ganho.taxaPlataforma,
        status: "COMPLETED" as const,
        description: `Taxa RotaCerta da corrida urbana (${ganho.percentual}% de repasse)`,
      },
    ]);
  }

  const rateio = await creditarRateioCooperativa({
    motoristaId,
    base,
    taxaAdministrativa: taxa,
    descricao: `Corrida urbana ${trecho}`,
    referencia: `urbana:${corridaId}`,
    corridaUrbanaId: corridaId,
  }).catch((e) => {
    console.error("[urbano] falha no rateio da cooperativa", e);
    return null;
  });

  if (rateio) {
    await supabaseAdmin
      .from("corridas_urbanas")
      .update({
        parcela_plataforma: rateio.parcelaPlataforma,
        parcela_cooperativa: rateio.parcelaCooperativa,
      })
      .eq("id", corridaId);
  }

  await registrarEvento({
    evento: "corrida_urbana_concluida",
    registradoPor: motoristaId,
    dados: {
      corrida_urbana_id: corridaId,
      base,
      taxa_administrativa: taxa,
      liquido_motorista: ganho.liquido,
      parcela_cooperativa: rateio?.parcelaCooperativa ?? 0,
    },
  }).catch((e) => console.error("[urbano] bloco não registrado", e));
}

export async function cancelarCorridaUrbana(params: {
  userId: string;
  corridaId: string;
  motivo?: string;
}) {
  const { data: corrida } = await supabaseAdmin
    .from("corridas_urbanas")
    .select("*")
    .eq("id", params.corridaId)
    .maybeSingle();
  if (!corrida) throw new Error("Corrida não encontrada.");

  const ehPassageiro = corrida.passageiro_id === params.userId;
  const ehMotorista = corrida.motorista_id === params.userId;
  if (!ehPassageiro && !ehMotorista) throw new Error("Você não participa desta corrida.");
  if (["concluida", "cancelada", "expirada"].includes(corrida.status)) {
    throw new Error("Esta corrida já está encerrada.");
  }

  const comCusto =
    ehPassageiro && CANCELAMENTO_COM_CUSTO.includes(corrida.status as StatusCorridaUrbana);

  const { data, error } = await supabaseAdmin
    .from("corridas_urbanas")
    .update({
      status: "cancelada",
      cancelada_por: ehPassageiro ? "passageiro" : "motorista",
      motivo_cancelamento: params.motivo?.trim() || null,
      taxa_cancelamento: comCusto ? n(corrida.taxa_cancelamento) : 0,
    })
    .eq("id", params.corridaId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { corrida: data, taxaAplicada: comCusto ? n(corrida.taxa_cancelamento) : 0 };
}

export async function avaliarCorridaUrbana(params: {
  userId: string;
  corridaId: string;
  nota: number;
}) {
  const nota = Math.min(5, Math.max(1, Math.round(params.nota)));
  const { data: corrida } = await supabaseAdmin
    .from("corridas_urbanas")
    .select("id, passageiro_id, motorista_id, status")
    .eq("id", params.corridaId)
    .maybeSingle();
  if (!corrida) throw new Error("Corrida não encontrada.");
  if (corrida.status !== "concluida") throw new Error("Avalie somente após a conclusão.");

  const campo =
    corrida.passageiro_id === params.userId
      ? "avaliacao_motorista"
      : corrida.motorista_id === params.userId
        ? "avaliacao_passageiro"
        : null;
  if (!campo) throw new Error("Você não participa desta corrida.");

  const { error } = await supabaseAdmin
    .from("corridas_urbanas")
    .update(
      campo === "avaliacao_motorista"
        ? { avaliacao_motorista: nota }
        : { avaliacao_passageiro: nota },
    )
    .eq("id", params.corridaId);
  if (error) throw new Error(error.message);
  return { ok: true, nota };
}

/** Corridas urbanas do passageiro (histórico e em andamento). */
export async function corridasDoPassageiro(userId: string) {
  const { data } = await supabaseAdmin
    .from("corridas_urbanas")
    .select("*")
    .eq("passageiro_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  return data ?? [];
}
