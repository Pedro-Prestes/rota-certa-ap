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
      "id, user_id, origem, destino, saida_ida, chegada_ida, distancia_km, assentos, preco_assento, status",
    )
    .eq("id", dados.rotaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rota || rota.status !== "ativa") throw new Error("Esta saída não está mais disponível.");

  const preco = Number(rota.preco_assento) || 0;
  // Bagagem excedente equivale a 60% do preço do assento (mesma regra da vitrine).
  const assentosValor = arred(preco * dados.assentos + preco * 0.6 * Math.max(0, dados.assentosBagagem));
  if (assentosValor <= 0) throw new Error("Esta saída ainda não tem tarifa publicada.");

  const desvio = await desvioDoEmbarque(dados.rotaId, dados.enderecoEmbarque);
  const base = arred(assentosValor + (desvio?.taxa ?? 0));

  const cfg = await configDoUsuario(dados.userId, dados.environment);
  return { rota, base, assentosValor, desvio, composicao: comporCobranca(base, cfg) };
}


/** Prévia do valor da reserva e do saldo disponível em créditos. */
export async function previaReserva(dados: EntradaReserva) {
  const { rota, composicao, assentosValor, desvio } = await rotaEComposicao(dados);
  const { saldo } = await carteiraDoUsuario(dados.userId, dados.environment);
  const faltando = arred(Math.max(0, composicao.total - saldo));
  return {
    origem: rota.origem,
    destino: rota.destino,
    assentosValor,
    desvio,
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
  const { rota, composicao } = await rotaEComposicao(dados);
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
  const pedidos = dados.assentos + Math.max(0, dados.assentosBagagem);
  if (capacidade > 0 && ocupados + pedidos > capacidade) {
    return { status: "lotado" as const, disponiveis: Math.max(0, capacidade - ocupados) };
  }

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
      assentos: dados.assentos,
      bagagem_l: 0,
      valor_tarifa: arred(Number(rota.preco_assento) * dados.assentos),
      valor_bagagem: arred(Number(rota.preco_assento) * 0.6 * Math.max(0, dados.assentosBagagem)),
      valor_pedagios: 0,
      valor_extras: 0,
      desconto: 0,
      comissao_percentual: 0,
      observacoes: "Reserva de lotação paga com créditos da carteira.",
    })
    .select("id")
    .single();
  if (erroCorrida) throw new Error(erroCorrida.message);

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
