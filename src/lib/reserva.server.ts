/**
 * Reserva de assento paga — garante a lotação antes da saída.
 *
 * Regra: o passageiro paga com os créditos da carteira. Se o saldo não cobrir
 * o total (base + taxa administrativa), a plataforma sugere o menor pacote de
 * créditos capaz de completar o valor, pago via Pix (Mercado Pago).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import { carteiraDoUsuario } from "./assinatura.server";
import { configDoUsuario } from "./cobranca.server";
import { comporCobranca } from "./taxas";
import {
  FRANQUIA_EXCLUSIVA_KG,
  PRECO_KG_EXCEDENTE,
  custoPesoExcedente,
  pesoExcedenteKg,
} from "./logistica";

import { PACOTES_CREDITO } from "./planos";
import type { StripeEnv } from "./stripe.server";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

export interface EntradaReserva {
  userId: string;
  rotaId: string;
  dataViagem: string;
  assentos: number;
  assentosBagagem: number;
  environment: StripeEnv;
  /** Endereço do embarque combinado — gera a taxa de desvio da rota. */
  enderecoEmbarque?: string | undefined;
  /** Reserva exclusiva da saída: tarifa integral do veículo. */
  exclusiva?: boolean | undefined;
  /** Peso total da bagagem (kg) — usado na franquia de 40 kg da exclusividade. */
  bagagemKg?: number | undefined;
  /** Viagem casada: cobra ida e volta na mesma reserva. */
  idaEVolta?: boolean | undefined;
  /** Data do trecho de retorno (obrigatória quando idaEVolta). */
  dataVolta?: string | undefined;
}



/** Menor pacote de créditos que cobre o valor faltante. */
export function pacoteSugerido(faltando: number): string {
  const ordenados = [...PACOTES_CREDITO].sort((a, b) => a.valor - b.valor);
  const escolhido = ordenados.find((p) => p.valor + p.bonus >= faltando) ?? ordenados.at(-1)!;
  return escolhido.priceId;
}

interface DesvioReserva {
  endereco: string;
  taxa: number;
  kmExtra: number;
  minutosExtra: number;
  provedor: string | undefined;
}

/** Taxa de desvio do ponto de embarque informado (0 quando não informado). */
async function desvioDoEmbarque(
  rotaId: string,
  endereco: string | undefined,
): Promise<DesvioReserva | null> {
  const alvo = endereco?.trim();
  if (!alvo || alvo.length < 6) return null;
  const { estimarPrecoPonto } = await import("./desvio.server");
  const r = await estimarPrecoPonto(supabaseAdmin, rotaId, alvo);
  return {
    endereco: r.enderecoFormatado,
    taxa: arred(r.taxaDesvio),
    kmExtra: r.metricas.kmExtra,
    minutosExtra: r.metricas.minutosExtra,
    provedor: r.metricas.provedor,
  };
}

async function rotaEComposicao(dados: EntradaReserva) {
  const { data: rota, error } = await supabaseAdmin
    .from("rotas")
    .select(
      "id, user_id, origem, destino, uf_origem, uf_destino, saida_ida, chegada_ida, saida_retorno, chegada_retorno, distancia_km, assentos, preco_assento, status",
    )

    .eq("id", dados.rotaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rota || rota.status !== "ativa") throw new Error("Esta saída não está mais disponível.");

  const preco = Number(rota.preco_assento) || 0;
  const capacidade = Number(rota.assentos) || 0;
  const exclusiva = dados.exclusiva === true;
  const idaEVolta = dados.idaEVolta === true;
  if (idaEVolta && !rota.saida_retorno) {
    throw new Error("Esta saída ainda não tem horário de retorno cadastrado.");
  }
  const dataVolta = idaEVolta ? (dados.dataVolta ?? dados.dataViagem) : null;
  if (dataVolta && dataVolta < dados.dataViagem) {
    throw new Error("A data da volta precisa ser igual ou posterior à data da ida.");
  }

  // Exclusividade: tarifa integral do veículo (todos os assentos), sem cálculo
  // por assento avulso; a bagagem tem franquia de 40 kg e o excedente é cobrado
  // por quilo. Sem exclusividade, mantém-se a regra da vitrine (60% por
  // assento-equivalente de bagagem).
  const excedenteKg = exclusiva ? pesoExcedenteKg(dados.bagagemKg ?? 0) : 0;
  const valorPesoExcedente = exclusiva ? arred(custoPesoExcedente(dados.bagagemKg ?? 0)) : 0;
  const assentosValor = exclusiva
    ? arred(preco * Math.max(1, capacidade) + valorPesoExcedente)
    : arred(preco * dados.assentos + preco * 0.6 * Math.max(0, dados.assentosBagagem));
  if (assentosValor <= 0) throw new Error("Esta saída ainda não tem tarifa publicada.");

  const desvio = await desvioDoEmbarque(dados.rotaId, dados.enderecoEmbarque);
  const taxaDesvio = desvio?.taxa ?? 0;

  // Desconto promocional publicado pelo motorista + desconto padrão do retorno.
  const { descontosVigentesDeRotas } = await import("./descontos.server");
  const { DESCONTO_RETORNO_PADRAO, aplicarDesconto, descontoVigente, economiaDesconto } =
    await import("./descontos");
  const vigentes = await descontosVigentesDeRotas([dados.rotaId]);
  const descontoIda = descontoVigente(vigentes, "ida");
  const descontoVolta = idaEVolta
    ? Math.max(descontoVigente(vigentes, "volta"), DESCONTO_RETORNO_PADRAO)
    : descontoVigente(vigentes, "volta");

  const valorIda = arred(aplicarDesconto(assentosValor, descontoIda) + taxaDesvio);
  const valorVolta = idaEVolta
    ? arred(aplicarDesconto(assentosValor, descontoVolta) + taxaDesvio)
    : 0;
  const economia = arred(
    economiaDesconto(assentosValor, descontoIda) +
      (idaEVolta ? economiaDesconto(assentosValor, descontoVolta) : 0),
  );

  const base = arred(valorIda + valorVolta);

  const cfg = await configDoUsuario(dados.userId, dados.environment);
  return {
    rota,
    base,
    assentosValor,
    desvio,
    exclusiva,
    capacidade,
    excedenteKg,
    valorPesoExcedente,
    idaEVolta,
    dataVolta,
    descontoIda,
    descontoVolta,
    valorIda,
    valorVolta,
    economia,
    composicao: comporCobranca(base, cfg),
  };
}


/** Prévia do valor da reserva e do saldo disponível em créditos. */
export async function previaReserva(dados: EntradaReserva) {
  const {
    rota,
    composicao,
    assentosValor,
    desvio,
    exclusiva,
    capacidade,
    excedenteKg,
    valorPesoExcedente,
    idaEVolta,
    dataVolta,
    descontoIda,
    descontoVolta,
    valorIda,
    valorVolta,
    economia,
  } = await rotaEComposicao(dados);
  const { saldo } = await carteiraDoUsuario(dados.userId, dados.environment);
  const faltando = arred(Math.max(0, composicao.total - saldo));
  return {
    origem: rota.origem,
    destino: rota.destino,
    ufOrigem: rota.uf_origem,
    ufDestino: rota.uf_destino,
    saidaRetorno: rota.saida_retorno,

    assentosValor,
    desvio,
    exclusiva,
    capacidade,
    excedenteKg,
    valorPesoExcedente,
    idaEVolta,
    dataVolta,
    descontoIda,
    descontoVolta,
    valorIda,
    valorVolta,
    economia,
    franquiaKg: FRANQUIA_EXCLUSIVA_KG,
    precoKgExcedente: PRECO_KG_EXCEDENTE,
    base: composicao.base,
    taxaAdministrativa: composicao.taxaAdministrativa,
    total: composicao.total,
    saldo,
    faltando,
    ...(faltando > 0 ? { pacoteSugerido: pacoteSugerido(faltando) } : {}),
  };


}


/**
 * Pix avulso pelo valor exato da corrida — não exige saldo prévio na carteira.
 * O valor cobrado é a base da reserva mais a taxa administrativa já apurada
 * (sem taxa dupla) e é creditado integralmente para liquidar a reserva.
 */
export async function criarPixDaCorrida(
  dados: EntradaReserva & {
    email: string;
    nome?: string | undefined;
    cpf?: string | undefined;
    notificationUrl: string;
  },
) {
  const { rota, composicao } = await rotaEComposicao(dados);
  const { criarPagamentoPix } = await import("./mercadopago.server");

  return criarPagamentoPix({
    userId: dados.userId,
    priceId: `corrida:${rota.id}:${dados.dataViagem}`,
    email: dados.email,
    ...(dados.nome ? { nome: dados.nome } : {}),
    ...(dados.cpf ? { cpf: dados.cpf } : {}),
    environment: dados.environment,
    notificationUrl: dados.notificationUrl,
    item: {
      finalidade: "corrida",
      base: composicao.base,
      creditos: composicao.total,
      descricao: `RotaCerta — Corrida ${rota.origem} → ${rota.destino} em ${dados.dataViagem}`,
      composicao: {
        base: composicao.base,
        taxaPercentual: composicao.taxaPercentualAplicada,
        taxaFixa: composicao.taxaFixa,
        taxaAdmin: composicao.taxaAdministrativa,
        total: composicao.total,
      },
    },
  });
}

/** Débita os créditos, registra o pagamento e garante o assento na saída. */
export async function reservarComCreditos(dados: EntradaReserva) {
  const {
    rota,
    composicao,
    exclusiva,
    valorPesoExcedente,
    idaEVolta,
    dataVolta,
    descontoIda,
    descontoVolta,
    economia,
  } = await rotaEComposicao(dados);

  const { saldo } = await carteiraDoUsuario(dados.userId, dados.environment);

  if (saldo < composicao.total) {
    const faltando = arred(composicao.total - saldo);
    return {
      status: "sem_saldo" as const,
      total: composicao.total,
      saldo,
      faltando,
      pacoteSugerido: pacoteSugerido(faltando),
    };
  }

  // Assentos já garantidos na mesma saída e data.
  const { data: reservados } = await supabaseAdmin
    .from("corridas")
    .select("assentos")
    .eq("data_corrida", dados.dataViagem)
    .eq("origem", rota.origem)
    .eq("destino", rota.destino);
  const ocupados = (reservados ?? []).reduce((a, r) => a + (Number(r.assentos) || 0), 0);
  const capacidade = Number(rota.assentos) || 0;
  if (exclusiva) {
    // A exclusividade só é possível quando ninguém mais reservou esta saída.
    if (ocupados > 0) {
      return { status: "lotado" as const, disponiveis: Math.max(0, capacidade - ocupados) };
    }
  } else {
    const pedidos = dados.assentos + Math.max(0, dados.assentosBagagem);
    if (capacidade > 0 && ocupados + pedidos > capacidade) {
      return { status: "lotado" as const, disponiveis: Math.max(0, capacidade - ocupados) };
    }
  }
  const assentosCorrida = exclusiva ? Math.max(1, capacidade) : dados.assentos;


  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("nome_completo")
    .eq("id", dados.userId)
    .maybeSingle();

  const { data: motorista } = await supabaseAdmin
    .from("profiles")
    .select("nome_completo")
    .eq("id", rota.user_id)
    .maybeSingle();

  const observacaoBase = exclusiva
    ? `Reserva exclusiva da saída (tarifa integral do veículo) paga com créditos. Bagagem ${(dados.bagagemKg ?? 0).toFixed(1)} kg — franquia de ${FRANQUIA_EXCLUSIVA_KG} kg.`
    : "Reserva de lotação paga com créditos da carteira.";
  const observacaoIda = idaEVolta
    ? `${observacaoBase} Viagem de ida e volta (trecho de ida) — retorno em ${dataVolta}.`
    : observacaoBase;

  const { data: corrida, error: erroCorrida } = await supabaseAdmin
    .from("corridas")
    .insert({
      user_id: dados.userId,
      passageiro_nome: perfil?.nome_completo || "Passageiro RotaCerta",
      motorista_nome: motorista?.nome_completo || "Motorista RotaCerta",
      origem: rota.origem,
      destino: rota.destino,
      data_corrida: dados.dataViagem,
      hora_partida: rota.saida_ida,
      hora_chegada: rota.chegada_ida,
      distancia_km: Number(rota.distancia_km) || 0,
      assentos: assentosCorrida,
      bagagem_l: 0,
      valor_tarifa: arred(Number(rota.preco_assento) * assentosCorrida),
      valor_bagagem: exclusiva
        ? valorPesoExcedente
        : arred(Number(rota.preco_assento) * 0.6 * Math.max(0, dados.assentosBagagem)),
      valor_pedagios: 0,
      valor_extras: 0,
      desconto: economia,
      desconto_percentual: descontoIda,
      trecho: "ida",
      comissao_percentual: 0,
      observacoes: observacaoIda,

    })
    .select("id")
    .single();
  if (erroCorrida) throw new Error(erroCorrida.message);

  // Trecho de retorno da viagem casada: fica vinculado ao trecho de ida.
  if (idaEVolta && dataVolta) {
    const { data: volta } = await supabaseAdmin
      .from("corridas")
      .insert({
        user_id: dados.userId,
        passageiro_nome: perfil?.nome_completo || "Passageiro RotaCerta",
        motorista_nome: motorista?.nome_completo || "Motorista RotaCerta",
        origem: rota.destino,
        destino: rota.origem,
        data_corrida: dataVolta,
        hora_partida: rota.saida_retorno,
        hora_chegada: rota.chegada_retorno,
        distancia_km: Number(rota.distancia_km) || 0,
        assentos: assentosCorrida,
        bagagem_l: 0,
        valor_tarifa: arred(Number(rota.preco_assento) * assentosCorrida),
        valor_bagagem: 0,
        valor_pedagios: 0,
        valor_extras: 0,
        desconto: 0,
        desconto_percentual: descontoVolta,
        trecho: "volta",
        reserva_par_id: corrida.id,
        comissao_percentual: 0,
        observacoes: `Trecho de volta da viagem casada paga com créditos (desconto de retorno de ${descontoVolta}%).`,
      })
      .select("id")
      .single();
    if (volta) {
      await supabaseAdmin
        .from("corridas")
        .update({ reserva_par_id: volta.id })
        .eq("id", corrida.id);
    }
  }


  const { data: pagamento, error: erroPagamento } = await supabaseAdmin
    .from("pagamentos")
    .insert({
      corrida_id: corrida.id,
      user_id: dados.userId,
      forma: "pix",
      status: "pago",
      valor: composicao.base,
      taxa_percentual: composicao.taxaPercentualAplicada,
      parcelas: 1,
      bandeira: "Créditos",
      autorizacao: `creditos:${corrida.id}`,
      pago_em: new Date().toISOString(),
      observacoes: `Reserva paga com créditos (${dados.environment}). Total R$ ${composicao.total.toFixed(
        2,
      )} — inclui taxa administrativa de R$ ${composicao.taxaAdministrativa.toFixed(2)}.`,
    })
    .select("id")
    .single();
  if (erroPagamento) throw new Error(erroPagamento.message);

  const { error: erroDebito } = await supabaseAdmin.from("carteira_transacoes").insert({
    user_id: dados.userId,
    tipo: "debito_corrida",
    valor: composicao.total,
    descricao: `Reserva ${rota.origem} → ${rota.destino} em ${dados.dataViagem}`,
    corrida_id: corrida.id,
    pagamento_id: pagamento.id,
    referencia_externa: `reserva:${corrida.id}`,
    environment: dados.environment,
  });
  if (erroDebito) throw new Error(erroDebito.message);

  const comp = competencia();
  await supabaseAdmin.from("lancamentos_contabeis").insert(
    [
      {
        tipo: "receita_bruta" as const,
        valor: composicao.total,
        descricao: "Reserva de assento paga com créditos",
      },
      {
        tipo: "taxa_plataforma" as const,
        valor: composicao.taxaAdministrativa,
        descricao: "Taxa administrativa da reserva de assento",
      },
      {
        tipo: "repasse_motorista" as const,
        valor: composicao.repasseMotorista,
        descricao: "Repasse devido ao motorista pela reserva",
      },
    ]
      .filter((l) => l.valor > 0)
      .map((l) => ({
        tipo: l.tipo,
        valor: l.valor,
        descricao: l.descricao,
        competencia: comp,
        corrida_id: corrida.id,
        pagamento_id: pagamento.id,
        detalhamento: {
          origem: "reserva_creditos",
          rota: rota.id,
          data_viagem: dados.dataViagem,
          assentos: dados.assentos,
          assentos_bagagem: dados.assentosBagagem,
          base: composicao.base,
          taxa_administrativa: composicao.taxaAdministrativa,
          total: composicao.total,
          ambiente: dados.environment,
        },
      })),
  );

  await supabaseAdmin.from("notificacoes").insert({
    user_id: dados.userId,
    titulo: "Assento garantido",
    mensagem: `Sua reserva ${rota.origem} → ${rota.destino} em ${dados.dataViagem} está paga e a lotação está garantida.`,
    tipo: "sucesso",
  });

  await registrarEvento({
    evento: "reserva_confirmada",
    corridaId: corrida.id,
    registradoPor: dados.userId,
    dados: {
      rota: rota.id,
      data_viagem: dados.dataViagem,
      assentos: dados.assentos,
      assentos_bagagem: dados.assentosBagagem,
      base: composicao.base,
      taxa_administrativa: composicao.taxaAdministrativa,
      total: composicao.total,
      pagamento: pagamento.id,
      ambiente: dados.environment,
    },
  });

  return {
    status: "confirmada" as const,
    corridaId: corrida.id,
    total: composicao.total,
    saldoRestante: arred(saldo - composicao.total),
  };
}
