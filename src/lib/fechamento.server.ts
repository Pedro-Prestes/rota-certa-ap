/**
 * Fechamento da saída e fila de confirmação.
 *
 * 60 minutos antes do horário programado de partida a plataforma fecha a saída:
 * monta a rota de busca com os endereços pré-reservados, calcula o valor de
 * cada passageiro pela ocupação (preço escalonado) e oferta o valor ao
 * passageiro com mais assentos. Ele tem 5 minutos para pagar. Se não pagar, a
 * pré-reserva expira, o preço é recalculado sem aquele ponto e a oferta passa
 * ao próximo. Sem nenhum pagamento confirmado ao fim da fila, a saída é
 * cancelada por inviabilidade.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { avisarTodosOsCanais } from "./avisos.server";
import { registrarEvento } from "./blockchain.server";
import { configDoUsuario } from "./cobranca.server";
import { comporCobranca } from "./taxas";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL } from "./dados";
import { matrizGeometrica, planejarBusca, type PontoBusca } from "./embarque";
import {
  ANTECEDENCIA_FECHAMENTO_MIN,
  PRAZO_OFERTA_MIN,
  ocupacaoDaSaida,
  precoDinamico,
} from "./preco-dinamico";
import type { StripeEnv } from "./stripe.server";

const arred = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const SITE = process.env["SITE_URL"] ?? "https://rotacertabrasil.com.br";

interface RotaSaida {
  id: string;
  user_id: string;
  origem: string;
  destino: string;
  uf_origem: string | null;
  uf_destino: string | null;
  saida_ida: string | null;
  chegada_ida: string | null;
  distancia_km: number | null;
  assentos: number | null;
  preco_assento: number | null;
  status: string;
}

interface PreReserva {
  id: string;
  rota_id: string;
  data_viagem: string;
  passageiro_id: string;
  assentos: number;
  assentos_bagagem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  taxa_desvio: number | null;
  km_desvio: number | null;
  minutos_desvio: number | null;
  valor_ofertado: number | null;
  oferta_expira_em: string | null;
  created_at: string;
}

/** Momento da partida programada (horário de Brasília). */
export function partidaProgramada(dataViagem: string, saida: string | null): Date | null {
  if (!saida) return null;
  const hora = saida.slice(0, 8).padEnd(8, ":00");
  const d = new Date(`${dataViagem}T${hora}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function rotaDaSaida(rotaId: string): Promise<RotaSaida | null> {
  const { data } = await supabaseAdmin
    .from("rotas")
    .select(
      "id, user_id, origem, destino, uf_origem, uf_destino, saida_ida, chegada_ida, distancia_km, assentos, preco_assento, status",
    )
    .eq("id", rotaId)
    .maybeSingle();
  return (data as RotaSaida | null) ?? null;
}

async function fila(rotaId: string, dataViagem: string): Promise<PreReserva[]> {
  const { data } = await supabaseAdmin
    .from("pre_reservas")
    .select(
      "id, rota_id, data_viagem, passageiro_id, assentos, assentos_bagagem, endereco, latitude, longitude, status, taxa_desvio, km_desvio, minutos_desvio, valor_ofertado, oferta_expira_em, created_at",
    )
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem)
    .in("status", ["pendente", "ofertada", "confirmada"]);
  const linhas = (data ?? []) as unknown as PreReserva[];
  // Mais assentos primeiro; empate pela ordem de chegada.
  return linhas.sort(
    (a, b) => b.assentos - a.assentos || a.created_at.localeCompare(b.created_at),
  );
}

/** Mede o desvio de cada pré-reserva e grava km/minutos/taxa. */
async function medirDesvios(rota: RotaSaida, pendentes: PreReserva[]) {
  const { estimarPrecoPonto } = await import("./desvio.server");
  for (const p of pendentes) {
    if (p.taxa_desvio != null) continue;
    try {
      const r = await estimarPrecoPonto(supabaseAdmin, rota.id, p.endereco);
      p.taxa_desvio = arred(r.taxaDesvio);
      p.km_desvio = arred(r.metricas.kmExtra);
      p.minutos_desvio = Math.round(r.metricas.minutosExtra);
      await supabaseAdmin
        .from("pre_reservas")
        .update({
          taxa_desvio: p.taxa_desvio,
          km_desvio: p.km_desvio,
          minutos_desvio: p.minutos_desvio,
        })
        .eq("id", p.id);
    } catch (e) {
      console.error(`[fechamento] desvio não medido para ${p.id}:`, e);
      p.taxa_desvio = 0;
      p.km_desvio = 0;
      p.minutos_desvio = 0;
    }
  }
}

/** Rota de busca otimizada preservando o horário de partida programado. */
async function planoDaBusca(rota: RotaSaida, pontos: PreReserva[], partida: Date) {
  const comCoordenada = pontos.filter((p) => p.latitude != null && p.longitude != null);
  if (comCoordenada.length === 0) return null;
  try {
    const { coordenadaLocalidade, pontoSaidaCidade } = await import("./embarque.server");
    const [origem, destino] = await Promise.all([
      coordenadaLocalidade(rota.origem, rota.uf_origem),
      coordenadaLocalidade(rota.destino, rota.uf_destino),
    ]);
    const lista: PontoBusca[] = comCoordenada.map((p) => ({
      id: p.id,
      rotulo: p.endereco,
      assentos: p.assentos,
      latitude: p.latitude!,
      longitude: p.longitude!,
    }));
    const saidaCidade = pontoSaidaCidade(origem, destino);
    const nos = [origem, ...lista, saidaCidade];
    return planejarBusca({
      base: origem,
      saidaCidade,
      pontos: lista,
      partida,
      precoCombustivel: PRECO_COMBUSTIVEL,
      consumoKmL: CONSUMO_KM_L,
      matriz: matrizGeometrica(nos),
    });
  } catch (e) {
    console.error("[fechamento] rota de busca não planejada:", e);
    return null;
  }
}

async function avisarMotorista(rota: RotaSaida, titulo: string, mensagem: string) {
  await avisarTodosOsCanais({
    userId: rota.user_id,
    titulo,
    mensagem,
    tipo: "info",
    link: `${SITE}/motorista`,
  });
}

/**
 * Oferta o valor ao próximo passageiro da fila, recalculando o preço conforme
 * os assentos que permanecem na saída.
 */
async function ofertarProximo(
  rota: RotaSaida,
  dataViagem: string,
  environment: StripeEnv,
): Promise<"ofertada" | "confirmada" | "cancelada" | "aguardando"> {
  const agora = new Date();
  const linhas = await fila(rota.id, dataViagem);

  const ofertada = linhas.find((p) => p.status === "ofertada");
  if (ofertada) {
    const expira = ofertada.oferta_expira_em ? new Date(ofertada.oferta_expira_em) : null;
    if (expira && expira > agora) return "aguardando";
    await supabaseAdmin.from("pre_reservas").update({ status: "expirada" }).eq("id", ofertada.id);
    await avisarTodosOsCanais({
      userId: ofertada.passageiro_id,
      titulo: "Prazo de pagamento encerrado",
      mensagem: `Sua pré-reserva ${rota.origem} → ${rota.destino} em ${dataViagem} expirou por falta de pagamento no prazo de ${PRAZO_OFERTA_MIN} minutos. A vaga foi ofertada ao próximo passageiro da fila.`,
      tipo: "alerta",
      link: `${SITE}/passageiro`,
    });
    return ofertarProximo(rota, dataViagem, environment);
  }

  const restantes = await fila(rota.id, dataViagem);
  const confirmadas = restantes.filter((p) => p.status === "confirmada");
  const pendentes = restantes.filter((p) => p.status === "pendente");
  const capacidade = Math.max(1, Number(rota.assentos) || 1);
  const assentosConfirmados = confirmadas.reduce((a, p) => a + p.assentos, 0);

  if (pendentes.length === 0) {
    const receita = arred(confirmadas.reduce((a, p) => a + (Number(p.valor_ofertado) || 0), 0));
    const final = assentosConfirmados > 0 ? "confirmada" : "cancelada";
    await supabaseAdmin
      .from("fechamentos_saida")
      .update({
        status: final,
        assentos_confirmados: assentosConfirmados,
        receita_confirmada: receita,
        ocupacao: ocupacaoDaSaida(assentosConfirmados, capacidade),
      })
      .eq("rota_id", rota.id)
      .eq("data_viagem", dataViagem);

    if (final === "cancelada") {
      await avisarMotorista(
        rota,
        "Saída cancelada por inviabilidade",
        `A saída ${rota.origem} → ${rota.destino} em ${dataViagem} foi cancelada: nenhum passageiro confirmou o pagamento no fechamento.`,
      );
      for (const p of restantes) {
        await avisarTodosOsCanais({
          userId: p.passageiro_id,
          titulo: "Saída cancelada",
          mensagem: `A saída ${rota.origem} → ${rota.destino} em ${dataViagem} foi cancelada por inviabilidade: nenhum passageiro confirmou o pagamento.`,
          tipo: "alerta",
          link: `${SITE}/passageiro`,
        });
      }
    } else {
      await avisarMotorista(
        rota,
        "Saída confirmada",
        `A saída ${rota.origem} → ${rota.destino} em ${dataViagem} está confirmada com ${assentosConfirmados} assento(s) pagos — receita de ${brl(receita)}.`,
      );
    }
    await registrarEvento({
      evento: final === "cancelada" ? "saida_cancelada" : "saida_confirmada",
      registradoPor: rota.user_id,
      dados: {
        rota: rota.id,
        data_viagem: dataViagem,
        assentos_confirmados: assentosConfirmados,
        receita: receita,
        ambiente: environment,
      },
    });
    return final;
  }

  const proximo = pendentes[0]!;
  const assentosNaSaida =
    assentosConfirmados + pendentes.reduce((a, p) => a + p.assentos, 0);

  const preco = precoDinamico({
    precoPublicado: Number(rota.preco_assento) || 0,
    assentosNaSaida,
    capacidade,
    assentos: proximo.assentos,
    assentosBagagem: proximo.assentos_bagagem,
    taxaDesvio: Number(proximo.taxa_desvio ?? 0),
  });

  const cfg = await configDoUsuario(proximo.passageiro_id, environment);
  const composicao = comporCobranca(preco.base, cfg);
  const expira = new Date(Date.now() + PRAZO_OFERTA_MIN * 60_000);

  await supabaseAdmin
    .from("pre_reservas")
    .update({
      status: "ofertada",
      valor_base: composicao.base,
      valor_ofertado: composicao.total,
      fator_ocupacao: preco.fator,
      oferta_enviada_em: new Date().toISOString(),
      oferta_expira_em: expira.toISOString(),
    })
    .eq("id", proximo.id);

  await avisarTodosOsCanais({
    userId: proximo.passageiro_id,
    titulo: `Valor da sua viagem: ${brl(composicao.total)}`,
    mensagem: [
      `Saída ${rota.origem} → ${rota.destino} em ${dataViagem}.`,
      `Assentos: ${proximo.assentos}. ${preco.faixa} (fator ${preco.fator.toFixed(2)}x).`,
      `Assento(s): ${brl(preco.valorAssentos)}${preco.valorBagagem > 0 ? ` + bagagem ${brl(preco.valorBagagem)}` : ""}${preco.taxaDesvio > 0 ? ` + desvio até seu embarque ${brl(preco.taxaDesvio)}` : ""}.`,
      `Taxa administrativa: ${brl(composicao.taxaAdministrativa)}. Total: ${brl(composicao.total)}.`,
      `Confirme pagando em até ${PRAZO_OFERTA_MIN} minutos, senão a vaga passa ao próximo passageiro.`,
    ].join(" "),
    tipo: "alerta",
    link: `${SITE}/passageiro?oferta=${proximo.id}`,
  });

  return "ofertada";
}

/** Fecha uma saída específica e inicia a fila de confirmação. */
export async function fecharSaida(
  rotaId: string,
  dataViagem: string,
  environment: StripeEnv = "live",
) {
  const rota = await rotaDaSaida(rotaId);
  if (!rota) throw new Error("Saída não encontrada.");
  const partida = partidaProgramada(dataViagem, rota.saida_ida);

  const linhas = await fila(rotaId, dataViagem);
  const pendentes = linhas.filter((p) => p.status === "pendente");
  const capacidade = Math.max(1, Number(rota.assentos) || 1);
  const assentosPre = linhas.reduce((a, p) => a + p.assentos, 0);

  await medirDesvios(rota, pendentes);
  const plano = partida ? await planoDaBusca(rota, pendentes, partida) : null;

  const { data: existente } = await supabaseAdmin
    .from("fechamentos_saida")
    .select("id, status")
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem)
    .maybeSingle();

  const registro = {
    rota_id: rotaId,
    data_viagem: dataViagem,
    partida_prevista: partida ? partida.toISOString() : null,
    assentos_prereservados: assentosPre,
    capacidade,
    ocupacao: ocupacaoDaSaida(assentosPre, capacidade),
    km_desvio_total: plano ? arred(plano.distanciaKm) : 0,
    minutos_desvio_total: plano ? plano.duracaoMin : 0,
    status: "em_fila" as const,
    observacoes: plano
      ? `Rota de busca com ${plano.paradas.length} parada(s). Motorista sai às ${new Date(plano.saidaMotorista).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} para preservar a partida programada.`
      : "Fechamento sem rota de busca georreferenciada.",
  };

  if (existente) {
    await supabaseAdmin.from("fechamentos_saida").update(registro).eq("id", existente.id);
  } else {
    await supabaseAdmin.from("fechamentos_saida").insert({
      ...registro,
      fechada_em: new Date().toISOString(),
    });
  }

  if (plano) {
    await avisarMotorista(
      rota,
      "Saída fechada — rota de busca definida",
      `A saída ${rota.origem} → ${rota.destino} em ${dataViagem} foi fechada com ${assentosPre} assento(s) pré-reservados. Rota de busca: ${plano.distanciaKm} km / ${plano.duracaoMin} min. Saia às ${new Date(plano.saidaMotorista).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} para manter o horário de partida.`,
    );
  }

  const resultado = await ofertarProximo(rota, dataViagem, environment);
  return { rotaId, dataViagem, assentosPre, plano, resultado };
}

/** Avança a fila de uma saída já fechada (expira ofertas vencidas). */
export async function avancarFila(
  rotaId: string,
  dataViagem: string,
  environment: StripeEnv = "live",
) {
  const rota = await rotaDaSaida(rotaId);
  if (!rota) throw new Error("Saída não encontrada.");
  return ofertarProximo(rota, dataViagem, environment);
}

/**
 * Rotina de minuto a minuto: fecha as saídas que entraram na janela de 60
 * minutos e avança as filas já em andamento.
 */
export async function processarFechamentos(environment: StripeEnv = "live") {
  const agora = new Date();
  const limite = new Date(agora.getTime() + ANTECEDENCIA_FECHAMENTO_MIN * 60_000);

  const { data: pendentes } = await supabaseAdmin
    .from("pre_reservas")
    .select("rota_id, data_viagem, status")
    .in("status", ["pendente", "ofertada"]);

  const saidas = new Map<string, { rotaId: string; dataViagem: string }>();
  for (const p of pendentes ?? []) {
    saidas.set(`${p.rota_id}|${p.data_viagem}`, {
      rotaId: p.rota_id as string,
      dataViagem: p.data_viagem as string,
    });
  }

  const fechadas: string[] = [];
  const avancadas: string[] = [];
  const ignoradas: string[] = [];

  for (const { rotaId, dataViagem } of saidas.values()) {
    const rota = await rotaDaSaida(rotaId);
    if (!rota || rota.status !== "ativa") continue;
    const partida = partidaProgramada(dataViagem, rota.saida_ida);
    if (!partida) continue;

    const { data: fechamento } = await supabaseAdmin
      .from("fechamentos_saida")
      .select("id, status")
      .eq("rota_id", rotaId)
      .eq("data_viagem", dataViagem)
      .maybeSingle();

    if (fechamento) {
      if (fechamento.status === "em_fila") {
        await avancarFila(rotaId, dataViagem, environment);
        avancadas.push(`${rotaId}|${dataViagem}`);
      }
      continue;
    }

    if (partida <= limite && partida > agora) {
      await fecharSaida(rotaId, dataViagem, environment);
      fechadas.push(`${rotaId}|${dataViagem}`);
    } else {
      ignoradas.push(`${rotaId}|${dataViagem}`);
    }
  }

  return {
    ambiente: environment,
    fechadas: fechadas.length,
    avancadas: avancadas.length,
    aguardando: ignoradas.length,
  };
}
