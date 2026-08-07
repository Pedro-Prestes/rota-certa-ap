/**
 * Carteira do motorista e repasses — lógica de servidor.
 *
 * • Ao concluir a viagem, o bruto das reservas aceitas é lançado como ganho e a
 *   taxa da plataforma é descontada, atualizando o saldo disponível na hora.
 * • O motorista cadastra conta bancária e/ou chave Pix (documento obrigatoriamente
 *   igual ao documento verificado do titular) e solicita saque instantâneo.
 * • Toda segunda-feira, 06:00, a rotina semanal repassa automaticamente os saldos
 *   acima de R$ 10,00 para a conta principal.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import { carregarConfig } from "./cobranca.server";
import {
  REPASSE_SEMANAL_MINIMO,
  SAQUE_MINIMO,
  comporGanhoViagem,
  comporSaque,
  nomeDoBanco,
  somenteDigitos,
  validarConta,
  type EntradaConta,
  type StatusRepasse,
} from "./carteira-motorista";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

async function garantirCarteira(driverId: string) {
  await supabaseAdmin
    .from("driver_wallet")
    .upsert({ driver_id: driverId }, { onConflict: "driver_id", ignoreDuplicates: true });
}

/** Painel completo da carteira do motorista. */
export async function painelCarteira(driverId: string) {
  await garantirCarteira(driverId);
  const [carteira, movimentos, contas, repasses] = await Promise.all([
    supabaseAdmin.from("driver_wallet").select("*").eq("driver_id", driverId).maybeSingle(),
    supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabaseAdmin
      .from("driver_bank_accounts")
      .select("*")
      .eq("driver_id", driverId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("driver_payouts")
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  return {
    carteira: {
      balance_available: Number(carteira.data?.balance_available ?? 0),
      balance_pending: Number(carteira.data?.balance_pending ?? 0),
      currency: carteira.data?.currency ?? "BRL",
    },
    movimentos: movimentos.data ?? [],
    contas: contas.data ?? [],
    repasses: repasses.data ?? [],
    saqueMinimo: SAQUE_MINIMO,
  };
}

/** Documento verificado do titular (antifraude: a conta precisa ser do motorista). */
async function documentoDoMotorista(driverId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("verificacoes_idoneidade")
    .select("documento, status, alvo")
    .eq("user_id", driverId)
    .eq("alvo", "motorista")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const doc = somenteDigitos(data?.documento ?? "");
  return doc.length >= 11 ? doc : null;
}

/** Cadastra (ou atualiza) uma conta de repasse do motorista. */
export async function salvarContaRepasse(params: {
  driverId: string;
  contaId?: string | undefined;
  dados: EntradaConta;
  principal: boolean;
}) {
  const problemas = validarConta(params.dados);
  if (problemas.length) throw new Error(problemas[0]!.mensagem);

  const documento = somenteDigitos(params.dados.holder_document);
  const doMotorista = await documentoDoMotorista(params.driverId);
  if (doMotorista && doMotorista !== documento) {
    throw new Error(
      "O CPF/CNPJ da conta precisa ser o mesmo documento do motorista verificado na plataforma.",
    );
  }

  const bankCode = somenteDigitos(params.dados.bank_code ?? "") || null;
  const registro = {
    driver_id: params.driverId,
    holder_name: params.dados.holder_name.trim(),
    holder_document: documento,
    bank_code: bankCode,
    bank_name: bankCode ? nomeDoBanco(bankCode) : null,
    account_type: (params.dados.account_type || null) as "CHECKING" | "SAVINGS" | null,
    agency_number: somenteDigitos(params.dados.agency_number ?? "") || null,
    account_number: somenteDigitos(params.dados.account_number ?? "") || null,
    pix_key_type: (params.dados.pix_key_type || null) as never,
    pix_key: params.dados.pix_key?.trim() || null,
  };

  const { count } = await supabaseAdmin
    .from("driver_bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", params.driverId);
  const principal = params.principal || (count ?? 0) === 0;

  if (principal) {
    await supabaseAdmin
      .from("driver_bank_accounts")
      .update({ is_primary: false })
      .eq("driver_id", params.driverId);
  }

  const payload = { ...registro, is_primary: principal };
  const { data, error } = params.contaId
    ? await supabaseAdmin
        .from("driver_bank_accounts")
        .update(payload)
        .eq("id", params.contaId)
        .eq("driver_id", params.driverId)
        .select("*")
        .single()
    : await supabaseAdmin.from("driver_bank_accounts").insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  await garantirCarteira(params.driverId);
  return { conta: data };
}

export async function definirContaPrincipal(driverId: string, contaId: string) {
  await supabaseAdmin
    .from("driver_bank_accounts")
    .update({ is_primary: false })
    .eq("driver_id", driverId);
  const { data, error } = await supabaseAdmin
    .from("driver_bank_accounts")
    .update({ is_primary: true })
    .eq("id", contaId)
    .eq("driver_id", driverId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { conta: data };
}

export async function removerContaRepasse(driverId: string, contaId: string) {
  const { error } = await supabaseAdmin
    .from("driver_bank_accounts")
    .delete()
    .eq("id", contaId)
    .eq("driver_id", driverId);
  if (error) throw new Error(error.message);
  return { removida: true };
}

/**
 * Lança o ganho da viagem concluída: bruto das reservas aceitas menos a taxa da
 * plataforma. Idempotente por viagem (índice único por viagem e tipo).
 */
export async function creditarGanhosDaViagem(params: {
  viagemId: string;
  motoristaId: string;
  env: string;
}) {
  const { data: viagem } = await supabaseAdmin
    .from("viagens")
    .select("id, rota_id, data_viagem, motorista_id")
    .eq("id", params.viagemId)
    .maybeSingle();
  if (!viagem) return { creditado: false, motivo: "Viagem não encontrada." };

  const { data: existente } = await supabaseAdmin
    .from("wallet_transactions")
    .select("id")
    .eq("viagem_id", params.viagemId)
    .eq("type", "RIDE_EARNING")
    .maybeSingle();
  if (existente) return { creditado: false, motivo: "Ganhos já lançados." };

  const { data: rota } = await supabaseAdmin
    .from("rotas")
    .select("preco_assento, origem, destino")
    .eq("id", viagem.rota_id)
    .maybeSingle();
  const preco = Number(rota?.preco_assento ?? 0) || 0;

  const { data: pontos } = await supabaseAdmin
    .from("pontos_embarque")
    .select("assentos, status")
    .eq("rota_id", viagem.rota_id)
    .eq("data_viagem", viagem.data_viagem)
    .eq("status", "aceito");

  const assentos = (pontos ?? []).reduce((t, p) => t + (Number(p.assentos) || 0), 0);
  const bruto = arred(preco * assentos);
  if (bruto <= 0) return { creditado: false, motivo: "Viagem sem reservas pagas." };

  const cfg = await carregarConfig();
  const ganho = comporGanhoViagem(bruto, cfg.repasse_motorista_percentual);
  const motoristaId = viagem.motorista_id ?? params.motoristaId;
  const trecho = `${rota?.origem ?? ""} → ${rota?.destino ?? ""}`;

  await garantirCarteira(motoristaId);
  const { error } = await supabaseAdmin.from("wallet_transactions").insert([
    {
      driver_id: motoristaId,
      type: "RIDE_EARNING" as const,
      amount: ganho.total,
      viagem_id: params.viagemId,
      status: "COMPLETED" as const,
      description: `Ganhos da viagem ${trecho} (${assentos} assento(s))`,
    },
    {
      driver_id: motoristaId,
      type: "PLATFORM_FEE" as const,
      amount: -ganho.taxaPlataforma,
      viagem_id: params.viagemId,
      status: "COMPLETED" as const,
      description: `Taxa RotaCerta (${arred(100 - ganho.percentual)}%) da viagem ${trecho}`,
    },
  ]);
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("lancamentos_contabeis").insert({
    tipo: "repasse_motorista",
    descricao: `Repasse ao motorista — viagem ${trecho}`,
    valor: ganho.liquido,
    competencia: competencia(),
    detalhamento: {
      viagem_id: params.viagemId,
      bruto: ganho.total,
      taxa_plataforma: ganho.taxaPlataforma,
      repasse_percentual: ganho.percentual,
      ambiente: params.env,
    },
  });

  await registrarEvento({
    evento: "ganho_motorista_creditado",
    registradoPor: motoristaId,
    dados: {
      viagem_id: params.viagemId,
      bruto: ganho.total,
      taxa_plataforma: ganho.taxaPlataforma,
      liquido: ganho.liquido,
      assentos,
      ambiente: params.env,
    },
  });

  return { creditado: true, ...ganho };
}

interface SolicitacaoSaque {
  driverId: string;
  valor: number;
  metodo: "PIX" | "TED";
  contaId?: string | undefined;
  modo?: "INSTANT" | "WEEKLY";
}

/** Cria o repasse, debita o saldo disponível e deixa a liquidação em andamento. */
export async function solicitarSaque(dados: SolicitacaoSaque) {
  const modo = dados.modo ?? "INSTANT";
  await garantirCarteira(dados.driverId);

  const { data: carteira } = await supabaseAdmin
    .from("driver_wallet")
    .select("balance_available")
    .eq("driver_id", dados.driverId)
    .maybeSingle();
  const disponivel = Number(carteira?.balance_available ?? 0);

  const composicao = comporSaque(dados.valor, modo);
  if (composicao.valor < SAQUE_MINIMO) {
    throw new Error(`O saque mínimo é de R$ ${SAQUE_MINIMO.toFixed(2).replace(".", ",")}.`);
  }
  if (composicao.valor > disponivel) throw new Error("Saldo disponível insuficiente para este saque.");

  const conta = dados.contaId
    ? await supabaseAdmin
        .from("driver_bank_accounts")
        .select("*")
        .eq("id", dados.contaId)
        .eq("driver_id", dados.driverId)
        .maybeSingle()
    : await supabaseAdmin
        .from("driver_bank_accounts")
        .select("*")
        .eq("driver_id", dados.driverId)
        .eq("is_primary", true)
        .maybeSingle();
  if (!conta.data) throw new Error("Cadastre uma conta de repasse antes de solicitar o saque.");
  if (dados.metodo === "PIX" && !conta.data.pix_key) {
    throw new Error("A conta escolhida não tem chave Pix cadastrada.");
  }
  if (dados.metodo === "TED" && !conta.data.account_number) {
    throw new Error("A conta escolhida não tem dados bancários completos para TED.");
  }

  const { data: repasse, error } = await supabaseAdmin
    .from("driver_payouts")
    .insert({
      driver_id: dados.driverId,
      bank_account_id: conta.data.id,
      amount: composicao.valor,
      fee: composicao.taxa,
      net_amount: composicao.liquido,
      payout_method: dados.metodo,
      mode: modo,
      status: "PROCESSING" as const,
      provider: "mercadopago",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const movimentos = [
    {
      driver_id: dados.driverId,
      type: "PAYOUT" as const,
      amount: -composicao.liquido,
      payout_id: repasse.id,
      status: "COMPLETED" as const,
      description: `Saque via ${dados.metodo} para ${conta.data.bank_name ?? "conta cadastrada"}`,
    },
    ...(composicao.taxa > 0
      ? [
          {
            driver_id: dados.driverId,
            type: "PLATFORM_FEE" as const,
            amount: -composicao.taxa,
            payout_id: repasse.id,
            status: "COMPLETED" as const,
            description: "Taxa de saque instantâneo",
          },
        ]
      : []),
  ];
  const { error: erroMov } = await supabaseAdmin.from("wallet_transactions").insert(movimentos);
  if (erroMov) {
    await supabaseAdmin
      .from("driver_payouts")
      .update({ status: "FAILED", failure_reason: erroMov.message })
      .eq("id", repasse.id);
    throw new Error(erroMov.message);
  }

  await registrarEvento({
    evento: "repasse_solicitado",
    registradoPor: dados.driverId,
    dados: {
      payout_id: repasse.id,
      valor: composicao.valor,
      taxa: composicao.taxa,
      liquido: composicao.liquido,
      metodo: dados.metodo,
      modo,
    },
  });

  return { repasse, ...composicao };
}

/** Conclusão (ou falha) da liquidação bancária — usada pela gestão e pelo gateway. */
export async function atualizarRepasse(params: {
  payoutId: string;
  status: Extract<StatusRepasse, "PAID" | "FAILED">;
  referencia?: string | undefined;
  motivo?: string | undefined;
}) {
  const { data: repasse } = await supabaseAdmin
    .from("driver_payouts")
    .select("*")
    .eq("id", params.payoutId)
    .maybeSingle();
  if (!repasse) throw new Error("Repasse não encontrado.");
  if (repasse.status === "PAID" || repasse.status === "FAILED") {
    return { repasse, jaProcessado: true };
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from("driver_payouts")
    .update({
      status: params.status,
      processed_at: new Date().toISOString(),
      provider_reference: params.referencia ?? null,
      failure_reason: params.status === "FAILED" ? (params.motivo ?? "Falha na liquidação") : null,
    })
    .eq("id", params.payoutId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (params.status === "FAILED") {
    // Devolve o valor debitado (líquido + taxa) ao saldo do motorista.
    await supabaseAdmin.from("wallet_transactions").insert({
      driver_id: repasse.driver_id,
      type: "ADJUSTMENT" as const,
      amount: arred(Number(repasse.amount)),
      payout_id: repasse.id,
      status: "COMPLETED" as const,
      description: `Devolução do saque não liquidado (${params.motivo ?? "falha no banco"})`,
    });
  }

  await registrarEvento({
    evento: params.status === "PAID" ? "repasse_liquidado" : "repasse_falhou",
    registradoPor: repasse.driver_id,
    dados: {
      payout_id: repasse.id,
      valor: Number(repasse.amount),
      liquido: Number(repasse.net_amount),
      referencia: params.referencia ?? null,
      motivo: params.motivo ?? null,
    },
  });

  return { repasse: atualizado, jaProcessado: false };
}

/** Repasse semanal automático: saldos acima de R$ 10,00 para a conta principal. */
export async function processarRepasseSemanal() {
  const { data: carteiras } = await supabaseAdmin
    .from("driver_wallet")
    .select("driver_id, balance_available")
    .gte("balance_available", REPASSE_SEMANAL_MINIMO);

  const resultados: { driver_id: string; valor?: number; erro?: string }[] = [];
  for (const c of carteiras ?? []) {
    try {
      const r = await solicitarSaque({
        driverId: c.driver_id,
        valor: Number(c.balance_available),
        metodo: "PIX",
        modo: "WEEKLY",
      });
      resultados.push({ driver_id: c.driver_id, valor: r.liquido });
    } catch (e) {
      resultados.push({ driver_id: c.driver_id, erro: (e as Error).message });
    }
  }

  return { processados: resultados.filter((r) => r.valor).length, total: resultados.length, resultados };
}

/** Visão da gestão: repasses pendentes de liquidação. */
export async function repassesPendentes() {
  const { data } = await supabaseAdmin
    .from("driver_payouts")
    .select("*")
    .in("status", ["REQUESTED", "PROCESSING"])
    .order("created_at", { ascending: true })
    .limit(100);
  return { repasses: data ?? [] };
}
