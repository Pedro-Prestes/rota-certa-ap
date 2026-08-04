/**
 * Assinatura paga com créditos da carteira.
 *
 * O Pix não suporta cobrança recorrente no provedor de pagamento. Para vender
 * planos com Pix, o usuário compra créditos (Pix ou cartão) e o plano é debitado
 * mensalmente do saldo da carteira, sem depender de recorrência do provedor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import { assinaturaVigente, carteiraDoUsuario } from "./assinatura.server";
import { planoDoPrice, precoPorId } from "./planos";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

/** Soma um mês de calendário à data (mantendo o último dia do mês quando preciso). */
export function somarUmMes(base: Date): Date {
  const d = new Date(base.getTime());
  const dia = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < dia) d.setDate(0);
  return d;
}

async function notificar(
  userId: string,
  titulo: string,
  mensagem: string,
  tipo: "info" | "sucesso" | "alerta" = "sucesso",
) {
  await supabaseAdmin.from("notificacoes").insert({ user_id: userId, titulo, mensagem, tipo });
}

export type AssinaturaCarteira = {
  id: string;
  user_id: string;
  price_id: string;
  valor_mensal: number;
  status: string;
  periodo_inicio: string;
  periodo_fim: string;
  proxima_cobranca: string;
  cancelar_no_fim: boolean;
  tentativas: number;
  environment: string;
};

export async function assinaturaCarteiraAtual(userId: string, env: StripeEnv) {
  const { data } = await supabaseAdmin
    .from("assinaturas_carteira")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AssinaturaCarteira | null) ?? null;
}

/** Assinatura de carteira com benefício liberado (inclui período pago já cancelado). */
export async function assinaturaCarteiraVigente(userId: string, env: StripeEnv) {
  const sub = await assinaturaCarteiraAtual(userId, env);
  if (!sub) return null;
  const dentro = new Date(sub.periodo_fim).getTime() > Date.now();
  if (!dentro) return null;
  if (sub.status === "cancelada" && !sub.cancelar_no_fim) return null;
  if (sub.status === "inadimplente") return null;
  return sub;
}

async function debitarCarteira(params: {
  userId: string;
  valor: number;
  descricao: string;
  referencia: string;
  env: StripeEnv;
}): Promise<{ ok: true } | { ok: false; motivo: "saldo" | "duplicado" }> {
  const { data: existente } = await supabaseAdmin
    .from("carteira_transacoes")
    .select("id")
    .eq("referencia_externa", params.referencia)
    .maybeSingle();
  if (existente) return { ok: false, motivo: "duplicado" };

  const { saldo } = await carteiraDoUsuario(params.userId, params.env);
  if (saldo + 0.001 < params.valor) return { ok: false, motivo: "saldo" };

  const { error } = await supabaseAdmin.from("carteira_transacoes").insert({
    user_id: params.userId,
    tipo: "debito_assinatura",
    valor: params.valor,
    descricao: params.descricao,
    referencia_externa: params.referencia,
    environment: params.env,
  });
  if (error) throw new Error(`Falha ao debitar a carteira: ${error.message}`);

  // A venda dos créditos já entrou como receita bruta; aqui registramos a
  // destinação do valor à manutenção automatizada da plataforma.
  await supabaseAdmin.from("lancamentos_contabeis").insert({
    tipo: "taxa_plataforma",
    valor: params.valor,
    descricao: params.descricao,
    competencia: competencia(),
    detalhamento: {
      origem: "assinatura_carteira",
      referencia: params.referencia,
      ambiente: params.env,
    },
  });

  return { ok: true };
}

/** Ativa um plano mensal debitando o valor do saldo de créditos. */
export async function ativarPlanoComCreditos(dados: {
  userId: string;
  priceId: string;
  environment: StripeEnv;
}) {
  const preco = precoPorId(dados.priceId);
  const plano = planoDoPrice(dados.priceId);
  if (!preco || !plano) throw new Error("Plano inválido.");
  if (preco.periodicidade !== "mensal") {
    throw new Error("A assinatura com créditos é cobrada mês a mês. Escolha o plano mensal.");
  }

  const stripeSub = await assinaturaVigente(dados.userId, dados.environment);
  if (stripeSub) {
    throw new Error("Você já tem um plano ativo pago no provedor. Cancele-o antes de usar créditos.");
  }
  const atual = await assinaturaCarteiraVigente(dados.userId, dados.environment);
  if (atual) {
    throw new Error("Você já tem um plano ativo pago com créditos. Use a troca de plano.");
  }

  const { saldo } = await carteiraDoUsuario(dados.userId, dados.environment);
  if (saldo + 0.001 < preco.valor) {
    throw new Error(
      `Saldo insuficiente: o plano custa R$ ${preco.valor.toFixed(2)} e você tem R$ ${saldo.toFixed(2)}. Compre créditos por Pix e tente de novo.`,
    );
  }

  const inicio = new Date();
  const fim = somarUmMes(inicio);

  const { data: registro, error } = await supabaseAdmin
    .from("assinaturas_carteira")
    .insert({
      user_id: dados.userId,
      price_id: dados.priceId,
      valor_mensal: preco.valor,
      status: "ativa",
      periodo_inicio: inicio.toISOString(),
      periodo_fim: fim.toISOString(),
      proxima_cobranca: fim.toISOString(),
      environment: dados.environment,
    })
    .select("id")
    .single();
  if (error || !registro) throw new Error(error?.message ?? "Não foi possível criar a assinatura.");

  const debito = await debitarCarteira({
    userId: dados.userId,
    valor: preco.valor,
    descricao: `Assinatura ${plano.nome} — período até ${fim.toLocaleDateString("pt-BR")}`,
    referencia: `assinatura_carteira:${registro.id}:${inicio.toISOString().slice(0, 10)}`,
    env: dados.environment,
  });
  if (!debito.ok) {
    await supabaseAdmin.from("assinaturas_carteira").delete().eq("id", registro.id);
    throw new Error("Não foi possível debitar os créditos. Verifique o saldo e tente de novo.");
  }

  await notificar(
    dados.userId,
    `${plano.nome} ativado com créditos`,
    `R$ ${preco.valor.toFixed(2)} foram debitados da sua carteira. A taxa administrativa das suas corridas passa a ser ${plano.taxa.taxa_percentual}% + R$ ${plano.taxa.taxa_fixa.toFixed(2)}. A próxima renovação é em ${fim.toLocaleDateString("pt-BR")} e será debitada do saldo.`,
  );

  await registrarEvento({
    evento: "assinatura_carteira_ativada",
    registradoPor: dados.userId,
    dados: {
      assinatura: registro.id,
      plano: dados.priceId,
      valor: preco.valor,
      periodo_fim: fim.toISOString(),
      ambiente: dados.environment,
    },
  });

  return { periodoFim: fim.toISOString(), valor: preco.valor };
}

/** Troca o plano da assinatura de carteira (vale na próxima renovação). */
export async function trocarPlanoCarteira(dados: {
  userId: string;
  priceId: string;
  environment: StripeEnv;
}) {
  const sub = await assinaturaCarteiraVigente(dados.userId, dados.environment);
  if (!sub) throw new Error("Nenhuma assinatura com créditos ativa.");
  if (sub.price_id === dados.priceId) throw new Error("Este já é o seu plano atual.");
  const preco = precoPorId(dados.priceId);
  const plano = planoDoPrice(dados.priceId);
  if (!preco || !plano || preco.periodicidade !== "mensal") throw new Error("Plano mensal inválido.");

  await supabaseAdmin
    .from("assinaturas_carteira")
    .update({
      price_id: dados.priceId,
      valor_mensal: preco.valor,
      cancelar_no_fim: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  await notificar(
    dados.userId,
    "Troca de plano agendada",
    `Seu plano atual vale até ${new Date(sub.periodo_fim).toLocaleDateString("pt-BR")}. Na renovação, serão debitados R$ ${preco.valor.toFixed(2)} do saldo para o ${plano.nome}.`,
    "info",
  );

  await registrarEvento({
    evento: "assinatura_carteira_plano_alterado",
    registradoPor: dados.userId,
    dados: { assinatura: sub.id, de: sub.price_id, para: dados.priceId, ambiente: dados.environment },
  });

  return { priceId: dados.priceId };
}

/** Cancelamento: imediato (corte na hora) ou no fim do período já debitado. */
export async function cancelarPlanoCarteira(dados: {
  userId: string;
  imediato: boolean;
  environment: StripeEnv;
}) {
  const sub = await assinaturaCarteiraAtual(dados.userId, dados.environment);
  if (!sub || sub.status === "cancelada") throw new Error("Nenhuma assinatura com créditos para cancelar.");
  const agora = new Date().toISOString();

  if (dados.imediato) {
    await supabaseAdmin
      .from("assinaturas_carteira")
      .update({
        status: "cancelada",
        cancelar_no_fim: false,
        periodo_fim: agora,
        proxima_cobranca: agora,
        updated_at: agora,
      })
      .eq("id", sub.id);
    await notificar(
      dados.userId,
      "Plano encerrado",
      "Seu plano pago com créditos foi encerrado agora. A taxa administrativa padrão volta a valer nas próximas corridas. Não há devolução proporcional dos créditos do período em curso.",
      "alerta",
    );
  } else {
    await supabaseAdmin
      .from("assinaturas_carteira")
      .update({ status: "cancelada", cancelar_no_fim: true, updated_at: agora })
      .eq("id", sub.id);
    await notificar(
      dados.userId,
      "Cancelamento agendado",
      `Seu plano continua valendo até ${new Date(sub.periodo_fim).toLocaleDateString("pt-BR")} e não haverá novo débito de créditos.`,
      "info",
    );
  }

  await registrarEvento({
    evento: dados.imediato ? "assinatura_carteira_cancelada" : "assinatura_carteira_cancelamento_agendado",
    registradoPor: dados.userId,
    dados: { assinatura: sub.id, plano: sub.price_id, ambiente: dados.environment },
  });

  return { imediato: dados.imediato };
}

/**
 * Renovação automática: debita os créditos das assinaturas vencidas.
 * Chamada pelo endpoint protegido de rotina (cron).
 */
export async function renovarAssinaturasCarteira(env: StripeEnv) {
  const agora = new Date();
  const { data: pendentes } = await supabaseAdmin
    .from("assinaturas_carteira")
    .select("*")
    .eq("environment", env)
    .in("status", ["ativa", "inadimplente"])
    .lte("proxima_cobranca", agora.toISOString())
    .limit(200);

  const resultado = { renovadas: 0, inadimplentes: 0, canceladas: 0 };

  for (const bruto of (pendentes ?? []) as AssinaturaCarteira[]) {
    const plano = planoDoPrice(bruto.price_id);
    const valor = arred(Number(bruto.valor_mensal));

    if (bruto.cancelar_no_fim) {
      await supabaseAdmin
        .from("assinaturas_carteira")
        .update({ status: "cancelada", updated_at: agora.toISOString() })
        .eq("id", bruto.id);
      resultado.canceladas += 1;
      continue;
    }

    const inicio = new Date(bruto.periodo_fim) > agora ? new Date(bruto.periodo_fim) : agora;
    const fim = somarUmMes(inicio);
    const debito = await debitarCarteira({
      userId: bruto.user_id,
      valor,
      descricao: `Renovação da assinatura ${plano?.nome ?? bruto.price_id} — período até ${fim.toLocaleDateString("pt-BR")}`,
      referencia: `assinatura_carteira:${bruto.id}:${inicio.toISOString().slice(0, 10)}`,
      env,
    });

    if (debito.ok) {
      await supabaseAdmin
        .from("assinaturas_carteira")
        .update({
          status: "ativa",
          periodo_inicio: inicio.toISOString(),
          periodo_fim: fim.toISOString(),
          proxima_cobranca: fim.toISOString(),
          tentativas: 0,
          updated_at: agora.toISOString(),
        })
        .eq("id", bruto.id);
      resultado.renovadas += 1;
      await notificar(
        bruto.user_id,
        "Assinatura renovada com créditos",
        `R$ ${valor.toFixed(2)} foram debitados da sua carteira. Seu plano ${plano?.nome ?? ""} vale até ${fim.toLocaleDateString("pt-BR")}.`,
      );
      await registrarEvento({
        evento: "assinatura_carteira_renovada",
        registradoPor: bruto.user_id,
        dados: { assinatura: bruto.id, plano: bruto.price_id, valor, periodo_fim: fim.toISOString(), ambiente: env },
      });
      continue;
    }

    if (debito.motivo === "duplicado") continue;

    const tentativas = bruto.tentativas + 1;
    const cancelar = tentativas >= 3;
    // Reagenda para o dia seguinte enquanto houver tentativas restantes.
    const proxima = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    await supabaseAdmin
      .from("assinaturas_carteira")
      .update({
        status: cancelar ? "cancelada" : "inadimplente",
        tentativas,
        proxima_cobranca: cancelar ? agora.toISOString() : proxima.toISOString(),
        updated_at: agora.toISOString(),
      })
      .eq("id", bruto.id);

    if (cancelar) resultado.canceladas += 1;
    else resultado.inadimplentes += 1;

    await notificar(
      bruto.user_id,
      cancelar ? "Plano cancelado por falta de créditos" : "Saldo insuficiente para renovar o plano",
      cancelar
        ? `Não foi possível debitar R$ ${valor.toFixed(2)} depois de 3 tentativas, e o plano foi encerrado. Compre créditos por Pix e ative o plano novamente quando quiser.`
        : `Faltam créditos para renovar o plano (R$ ${valor.toFixed(2)}). Compre créditos por Pix hoje: tentaremos novamente amanhã. Enquanto isso, vale a taxa administrativa padrão.`,
      "alerta",
    );

    await registrarEvento({
      evento: cancelar ? "assinatura_carteira_cancelada_sem_saldo" : "assinatura_carteira_sem_saldo",
      registradoPor: bruto.user_id,
      dados: { assinatura: bruto.id, plano: bruto.price_id, valor, tentativas, ambiente: env },
    });
  }

  return resultado;
}
