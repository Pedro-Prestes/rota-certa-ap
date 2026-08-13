/**
 * Pagamento da oferta gerada no fechamento da saída.
 *
 * O valor já foi fechado pela plataforma (preço escalonado pela ocupação +
 * desvio do embarque + taxa administrativa). Aqui o passageiro apenas aceita e
 * paga — com créditos da carteira ou com Pix avulso pelo valor exato.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { carteiraDoUsuario } from "./assinatura.server";
import { registrarEvento } from "./blockchain.server";
import { configDoUsuario } from "./cobranca.server";
import { comporCobranca } from "./taxas";
import { pacoteSugerido } from "./reserva.server";
import { PRAZO_OFERTA_MIN } from "./preco-dinamico";
import type { StripeEnv } from "./stripe.server";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

interface OfertaCarregada {
  id: string;
  rota_id: string;
  data_viagem: string;
  passageiro_id: string;
  assentos: number;
  assentos_bagagem: number;
  endereco: string;
  valor_base: number | null;
  valor_ofertado: number | null;
  taxa_desvio: number | null;
  fator_ocupacao: number | null;
  oferta_expira_em: string | null;
  status: string;
}

async function carregarOferta(preReservaId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("pre_reservas")
    .select(
      "id, rota_id, data_viagem, passageiro_id, assentos, assentos_bagagem, endereco, valor_base, valor_ofertado, taxa_desvio, fator_ocupacao, oferta_expira_em, status",
    )
    .eq("id", preReservaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const oferta = data as unknown as OfertaCarregada | null;
  if (!oferta || oferta.passageiro_id !== userId) throw new Error("Oferta não encontrada.");
  if (oferta.status !== "ofertada") {
    throw new Error(
      oferta.status === "confirmada"
        ? "Esta reserva já está paga."
        : "Esta oferta não está mais disponível.",
    );
  }
  if (oferta.oferta_expira_em && new Date(oferta.oferta_expira_em) < new Date()) {
    throw new Error(`O prazo de ${PRAZO_OFERTA_MIN} minutos para pagar esta oferta terminou.`);
  }
  if (!oferta.valor_ofertado || !oferta.valor_base) {
    throw new Error("A oferta ainda não tem valor calculado.");
  }

  const { data: rota } = await supabaseAdmin
    .from("rotas")
    .select("id, user_id, origem, destino, saida_ida, chegada_ida, distancia_km, preco_assento")
    .eq("id", oferta.rota_id)
    .maybeSingle();
  if (!rota) throw new Error("Saída não encontrada.");
  return { oferta, rota };
}

/** Paga a oferta com os créditos da carteira e garante o assento. */
export async function pagarOfertaComCreditos(
  preReservaId: string,
  userId: string,
  environment: StripeEnv = "live",
) {
  const { oferta, rota } = await carregarOferta(preReservaId, userId);
  const total = Number(oferta.valor_ofertado);
  const base = Number(oferta.valor_base);

  const { saldo } = await carteiraDoUsuario(userId, environment);
  if (saldo < total) {
    const faltando = arred(total - saldo);
    return {
      status: "sem_saldo" as const,
      total,
      saldo,
      faltando,
      pacoteSugerido: pacoteSugerido(faltando),
    };
  }

  const cfg = await configDoUsuario(userId, environment);
  const composicao = comporCobranca(base, cfg);

  const [{ data: perfil }, { data: motorista }] = await Promise.all([
    supabaseAdmin.from("profiles").select("nome_completo").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("profiles").select("nome_completo").eq("id", rota.user_id).maybeSingle(),
  ]);

  const { data: corrida, error: erroCorrida } = await supabaseAdmin
    .from("corridas")
    .insert({
      user_id: userId,
      passageiro_nome: perfil?.nome_completo || "Passageiro RotaCerta",
      motorista_nome: motorista?.nome_completo || "Motorista RotaCerta",
      origem: rota.origem,
      destino: rota.destino,
      data_corrida: oferta.data_viagem,
      hora_partida: rota.saida_ida,
      hora_chegada: rota.chegada_ida,
      distancia_km: Number(rota.distancia_km) || 0,
      assentos: oferta.assentos,
      bagagem_l: 0,
      valor_tarifa: arred(base - Number(oferta.taxa_desvio ?? 0)),
      valor_bagagem: 0,
      valor_pedagios: 0,
      valor_extras: arred(Number(oferta.taxa_desvio ?? 0)),
      desconto: 0,
      comissao_percentual: 0,
      observacoes: `Reserva confirmada no fechamento da saída (fator de ocupação ${Number(oferta.fator_ocupacao ?? 1).toFixed(2)}x). Embarque em ${oferta.endereco}.`,
    })
    .select("id")
    .single();
  if (erroCorrida) throw new Error(erroCorrida.message);

  const { data: pagamento, error: erroPagamento } = await supabaseAdmin
    .from("pagamentos")
    .insert({
      corrida_id: corrida.id,
      user_id: userId,
      forma: "pix",
      status: "pago",
      valor: composicao.base,
      taxa_percentual: composicao.taxaPercentualAplicada,
      parcelas: 1,
      bandeira: "Créditos",
      autorizacao: `oferta:${oferta.id}`,
      pago_em: new Date().toISOString(),
      observacoes: `Oferta do fechamento paga com créditos (${environment}). Total R$ ${total.toFixed(2)}.`,
    })
    .select("id")
    .single();
  if (erroPagamento) throw new Error(erroPagamento.message);

  const { error: erroDebito } = await supabaseAdmin.from("carteira_transacoes").insert({
    user_id: userId,
    tipo: "debito_corrida",
    valor: total,
    descricao: `Reserva ${rota.origem} → ${rota.destino} em ${oferta.data_viagem}`,
    corrida_id: corrida.id,
    pagamento_id: pagamento.id,
    referencia_externa: `oferta:${oferta.id}`,
    environment,
  });
  if (erroDebito) throw new Error(erroDebito.message);

  const comp = competencia();
  await supabaseAdmin.from("lancamentos_contabeis").insert(
    [
      { tipo: "receita_bruta" as const, valor: total, descricao: "Reserva confirmada no fechamento da saída" },
      {
        tipo: "taxa_plataforma" as const,
        valor: composicao.taxaAdministrativa,
        descricao: "Taxa administrativa da reserva fechada",
      },
      {
        tipo: "repasse_motorista" as const,
        valor: composicao.repasseMotorista,
        descricao: "Repasse devido ao motorista pela reserva fechada",
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
          origem: "fechamento_saida",
          rota: rota.id,
          data_viagem: oferta.data_viagem,
          assentos: oferta.assentos,
          fator_ocupacao: oferta.fator_ocupacao,
          taxa_desvio: oferta.taxa_desvio,
          base: composicao.base,
          taxa_administrativa: composicao.taxaAdministrativa,
          total,
          ambiente: environment,
        },
      })),
  );

  await supabaseAdmin
    .from("pre_reservas")
    .update({ status: "confirmada", corrida_id: corrida.id })
    .eq("id", oferta.id);

  await atualizarReceita(oferta.rota_id, oferta.data_viagem);

  await registrarEvento({
    evento: "reserva_confirmada",
    corridaId: corrida.id,
    registradoPor: userId,
    dados: {
      rota: rota.id,
      data_viagem: oferta.data_viagem,
      pre_reserva: oferta.id,
      assentos: oferta.assentos,
      total,
      fator_ocupacao: oferta.fator_ocupacao,
      ambiente: environment,
    },
  });

  const { avancarFila } = await import("./fechamento.server");
  await avancarFila(oferta.rota_id, oferta.data_viagem, environment);

  return {
    status: "confirmada" as const,
    corridaId: corrida.id,
    total,
    saldoRestante: arred(saldo - total),
  };
}

/** Soma dos valores confirmados da saída no registro de fechamento. */
async function atualizarReceita(rotaId: string, dataViagem: string) {
  const { data } = await supabaseAdmin
    .from("pre_reservas")
    .select("assentos, valor_ofertado")
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem)
    .eq("status", "confirmada");
  const linhas = data ?? [];
  await supabaseAdmin
    .from("fechamentos_saida")
    .update({
      assentos_confirmados: linhas.reduce((a, l) => a + (Number(l.assentos) || 0), 0),
      receita_confirmada: arred(linhas.reduce((a, l) => a + (Number(l.valor_ofertado) || 0), 0)),
    })
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem);
}

/** Pix avulso pelo valor exato da oferta (sem exigir saldo em carteira). */
export async function gerarPixDaOferta(dados: {
  preReservaId: string;
  userId: string;
  email: string;
  nome?: string | undefined;
  cpf?: string | undefined;
  environment: StripeEnv;
  notificationUrl: string;
}) {
  const { oferta, rota } = await carregarOferta(dados.preReservaId, dados.userId);
  const base = Number(oferta.valor_base);
  const total = Number(oferta.valor_ofertado);
  const cfg = await configDoUsuario(dados.userId, dados.environment);
  const composicao = comporCobranca(base, cfg);
  const { criarPagamentoPix } = await import("./mercadopago.server");

  return criarPagamentoPix({
    userId: dados.userId,
    priceId: `oferta:${oferta.id}`,
    email: dados.email,
    ...(dados.nome ? { nome: dados.nome } : {}),
    ...(dados.cpf ? { cpf: dados.cpf } : {}),
    environment: dados.environment,
    notificationUrl: dados.notificationUrl,
    item: {
      finalidade: "corrida",
      base: composicao.base,
      creditos: total,
      descricao: `RotaCerta — ${rota.origem} → ${rota.destino} em ${oferta.data_viagem}`,
      composicao: {
        base: composicao.base,
        taxaPercentual: composicao.taxaPercentualAplicada,
        taxaFixa: composicao.taxaFixa,
        taxaAdmin: composicao.taxaAdministrativa,
        total,
      },
    },
  });
}
