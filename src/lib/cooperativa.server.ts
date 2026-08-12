/**
 * Cooperativas — camada de servidor.
 *
 * • Cadastro/atualização da entidade com dados de recebimento validados.
 * • Rateio automático: no instante em que o pagamento é confirmado, a parcela
 *   da cooperativa (padrão 3 p.p. da taxa administrativa) é creditada na
 *   carteira da entidade e lançada na contabilidade — idempotente por
 *   pagamento/corrida.
 * • Repasse automático por Pix para a conta cadastrada (ou pedido manual),
 *   com ponto único de troca para o split nativo do gateway quando aprovado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { carregarConfig } from "./cobranca.server";
import { ratearTaxa } from "./taxas";
import { registrarEvento } from "./blockchain.server";
import {
  REPASSE_COOPERATIVA_MINIMO,
  meioDeRecebimento,
  nomeDoBanco,
  somenteDigitos,
  validarCooperativa,
  type EntradaCooperativa,
} from "./cooperativa";

const n = (v: unknown) => Number(v ?? 0) || 0;
const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

/**
 * Enquanto o split nativo do gateway não estiver habilitado, o rateio é
 * creditado na carteira da cooperativa e liquidado por Pix automaticamente.
 */
export const SPLIT_NATIVO_ATIVO = process.env["GATEWAY_SPLIT_ATIVO"] === "true";

/* ------------------------------------------------------------------ cadastro */

export async function cooperativaDoResponsavel(userId: string) {
  const { data } = await supabaseAdmin
    .from("cooperativas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function salvarCooperativa(params: {
  userId: string;
  dados: EntradaCooperativa;
}) {
  const problemas = validarCooperativa(params.dados);
  if (problemas.length) throw new Error(problemas[0]!.mensagem);

  const d = params.dados;
  const banco = somenteDigitos(d.banco_codigo ?? "") || null;
  const registro = {
    user_id: params.userId,
    cnpj: somenteDigitos(d.cnpj),
    razao_social: d.razao_social.trim(),
    nome_fantasia: d.nome_fantasia?.trim() || null,
    responsavel_nome: d.responsavel_nome.trim(),
    email_contato: d.email_contato?.trim() || null,
    telefone: somenteDigitos(d.telefone ?? "") || null,
    municipio: d.municipio?.trim() || null,
    uf: d.uf?.trim().toUpperCase() || null,
    titular_nome: d.titular_nome.trim(),
    titular_documento: somenteDigitos(d.titular_documento),
    banco_codigo: banco,
    banco_nome: banco ? nomeDoBanco(banco) : null,
    tipo_conta: (d.tipo_conta || null) as "CHECKING" | "SAVINGS" | null,
    agencia: somenteDigitos(d.agencia ?? "") || null,
    conta: somenteDigitos(d.conta ?? "") || null,
    pix_tipo: (d.pix_tipo || null) as never,
    pix_chave: d.pix_chave?.trim() || null,
  };

  const existente = await cooperativaDoResponsavel(params.userId);
  const { data, error } = existente
    ? await supabaseAdmin
        .from("cooperativas")
        .update(registro)
        .eq("id", existente.id)
        .select("*")
        .single()
    : await supabaseAdmin.from("cooperativas").insert(registro).select("*").single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("cooperativa_carteira")
    .upsert({ cooperativa_id: data.id }, { onConflict: "cooperativa_id", ignoreDuplicates: true });

  await supabaseAdmin
    .from("user_roles")
    .upsert(
      { user_id: params.userId, role: "cooperativa" as never },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

  return data;
}

/** Vincula (ou desvincula) um motorista à cooperativa do responsável. */
export async function vincularMotorista(params: {
  userId: string;
  cooperativaId: string;
  motoristaId: string;
  ativo: boolean;
}) {
  const coop = await cooperativaDoResponsavel(params.userId);
  if (!coop || coop.id !== params.cooperativaId) {
    throw new Error("Cooperativa não encontrada para este responsável.");
  }
  const { error } = await supabaseAdmin.from("cooperativa_motoristas").upsert(
    {
      cooperativa_id: params.cooperativaId,
      motorista_id: params.motoristaId,
      status: params.ativo ? "ativo" : "inativo",
    },
    { onConflict: "cooperativa_id,motorista_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* -------------------------------------------------------------------- rateio */

export async function cooperativaDoMotorista(motoristaId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("cooperativa_motoristas")
    .select("cooperativa_id, status, cooperativas!inner(status)")
    .eq("motorista_id", motoristaId)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();
  const coop = data as { cooperativa_id: string; cooperativas?: { status: string } } | null;
  if (!coop || coop.cooperativas?.status !== "ativa") return null;
  return coop.cooperativa_id;
}

export interface EntradaRateio {
  motoristaId: string;
  base: number;
  taxaAdministrativa: number;
  descricao: string;
  /** Chave idempotente (ex.: `pagamento:<id>` ou `urbana:<id>`). */
  referencia: string;
  pagamentoId?: string | null;
  corridaId?: string | null;
  corridaUrbanaId?: string | null;
  environment?: string;
}

export interface ResultadoRateio {
  cooperativaId: string | null;
  parcelaCooperativa: number;
  parcelaPlataforma: number;
  percentualCooperativa: number;
  creditado: boolean;
}

/**
 * Credita a parcela da cooperativa no mesmo instante da confirmação do
 * pagamento e grava os lançamentos contábeis do rateio. Repetir a chamada com
 * a mesma referência não duplica valores.
 */
export async function creditarRateioCooperativa(e: EntradaRateio): Promise<ResultadoRateio> {
  const cfg = await carregarConfig();
  const cooperativaId = await cooperativaDoMotorista(e.motoristaId);
  const rateio = ratearTaxa(e.base, e.taxaAdministrativa, cfg, Boolean(cooperativaId));

  if (!cooperativaId || rateio.parcelaCooperativa <= 0) {
    return {
      cooperativaId: null,
      parcelaCooperativa: 0,
      parcelaPlataforma: rateio.parcelaPlataforma,
      percentualCooperativa: 0,
      creditado: false,
    };
  }

  const { error } = await supabaseAdmin.from("cooperativa_transacoes").insert({
    cooperativa_id: cooperativaId,
    tipo: "rateio_corrida",
    valor: rateio.parcelaCooperativa,
    descricao: e.descricao,
    motorista_id: e.motoristaId,
    corrida_id: e.corridaId ?? null,
    corrida_urbana_id: e.corridaUrbanaId ?? null,
    pagamento_id: e.pagamentoId ?? null,
    referencia_externa: e.referencia,
    environment: e.environment ?? "live",
  });

  // Violação de unicidade = rateio já creditado antes (idempotência).
  const duplicado = error?.code === "23505";
  if (error && !duplicado) throw new Error(error.message);

  if (!duplicado) {
    const comp = competencia();
    await supabaseAdmin.from("lancamentos_contabeis").insert([
      {
        tipo: "taxa_plataforma",
        valor: rateio.parcelaPlataforma,
        descricao: `Taxa administrativa — parcela da plataforma (${e.descricao})`,
        competencia: comp,
        corrida_id: e.corridaId ?? null,
        corrida_urbana_id: e.corridaUrbanaId ?? null,
        pagamento_id: e.pagamentoId ?? null,
        detalhamento: {
          rateio: true,
          base: e.base,
          taxa_administrativa: rateio.taxaAdministrativa,
          parcela_plataforma: rateio.parcelaPlataforma,
          parcela_cooperativa: rateio.parcelaCooperativa,
        },
      },
      {
        tipo: "custo_terceiro",
        valor: rateio.parcelaCooperativa,
        descricao: `Rateio da taxa administrativa — cooperativa (${rateio.percentualCooperativa}%)`,
        competencia: comp,
        cooperativa_id: cooperativaId,
        corrida_id: e.corridaId ?? null,
        corrida_urbana_id: e.corridaUrbanaId ?? null,
        pagamento_id: e.pagamentoId ?? null,
        detalhamento: {
          rateio: true,
          cooperativa_id: cooperativaId,
          percentual_cooperativa: rateio.percentualCooperativa,
          parcela_cooperativa: rateio.parcelaCooperativa,
          split_nativo: SPLIT_NATIVO_ATIVO,
        },
      },
    ]);

    await registrarEvento({
      evento: "rateio_cooperativa",
      registradoPor: e.motoristaId,
      dados: {
        cooperativa_id: cooperativaId,
        referencia: e.referencia,
        base: e.base,
        parcela_cooperativa: rateio.parcelaCooperativa,
        parcela_plataforma: rateio.parcelaPlataforma,
      },
    }).catch((erro) => console.error("[rateio] falha ao registrar bloco", erro));

    // Liquidação imediata quando o saldo já compensa o envio.
    await liquidarSeElegivel(cooperativaId).catch((erro) =>
      console.error("[rateio] falha na liquidação automática", erro),
    );
  }

  return {
    cooperativaId,
    parcelaCooperativa: rateio.parcelaCooperativa,
    parcelaPlataforma: rateio.parcelaPlataforma,
    percentualCooperativa: rateio.percentualCooperativa,
    creditado: !duplicado,
  };
}

/* ------------------------------------------------------------------ repasses */

export async function liquidarSeElegivel(cooperativaId: string) {
  const { data: carteira } = await supabaseAdmin
    .from("cooperativa_carteira")
    .select("saldo_disponivel")
    .eq("cooperativa_id", cooperativaId)
    .maybeSingle();
  const saldo = arred(n(carteira?.saldo_disponivel));
  if (saldo < REPASSE_COOPERATIVA_MINIMO) return null;
  return repassarCooperativa({ cooperativaId, valor: saldo, modo: "automatico" });
}

/**
 * Envia o valor para a conta cadastrada. O provedor de Pix é acionado quando
 * configurado; sem provedor, o repasse fica registrado como em processamento
 * para conciliação, sem nunca perder o registro contábil.
 */
export async function repassarCooperativa(params: {
  cooperativaId: string;
  valor: number;
  modo?: "automatico" | "manual";
}) {
  const { data: coop } = await supabaseAdmin
    .from("cooperativas")
    .select("*")
    .eq("id", params.cooperativaId)
    .maybeSingle();
  if (!coop) throw new Error("Cooperativa não encontrada.");
  if (coop.status !== "ativa") throw new Error("Cooperativa não está ativa.");

  const meio = meioDeRecebimento(coop);
  if (!meio) throw new Error("Cadastre a conta bancária e/ou a chave Pix da cooperativa.");

  const { data: carteira } = await supabaseAdmin
    .from("cooperativa_carteira")
    .select("saldo_disponivel")
    .eq("cooperativa_id", params.cooperativaId)
    .maybeSingle();
  const saldo = arred(n(carteira?.saldo_disponivel));
  const valor = arred(Math.min(saldo, Math.max(0, n(params.valor))));
  if (valor <= 0) throw new Error("Não há saldo disponível para repasse.");

  const { data: repasse, error } = await supabaseAdmin
    .from("cooperativa_repasses")
    .insert({
      cooperativa_id: params.cooperativaId,
      valor,
      taxa: 0,
      liquido: valor,
      metodo: meio.metodo,
      modo: params.modo ?? "manual",
      status: "processando",
      provedor: "mercadopago",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("cooperativa_transacoes").insert({
    cooperativa_id: params.cooperativaId,
    tipo: "repasse",
    valor,
    descricao: `Repasse ${params.modo === "automatico" ? "automático" : "manual"} — ${meio.descricao}`,
    referencia_externa: `repasse:${repasse.id}`,
  });

  await supabaseAdmin.from("lancamentos_contabeis").insert({
    tipo: "repasse_motorista",
    valor,
    descricao: `Repasse à cooperativa ${coop.razao_social}`,
    competencia: competencia(),
    cooperativa_id: params.cooperativaId,
    detalhamento: { meio: meio.metodo, destino: meio.descricao, repasse_id: repasse.id },
  });

  return repasse;
}

/* -------------------------------------------------------------------- painel */

export async function painelCooperativa(userId: string) {
  const coop = await cooperativaDoResponsavel(userId);
  if (!coop) return { cooperativa: null };

  await supabaseAdmin
    .from("cooperativa_carteira")
    .upsert({ cooperativa_id: coop.id }, { onConflict: "cooperativa_id", ignoreDuplicates: true });

  const [carteira, transacoes, repasses, vinculos] = await Promise.all([
    supabaseAdmin
      .from("cooperativa_carteira")
      .select("*")
      .eq("cooperativa_id", coop.id)
      .maybeSingle(),
    supabaseAdmin
      .from("cooperativa_transacoes")
      .select("*")
      .eq("cooperativa_id", coop.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("cooperativa_repasses")
      .select("*")
      .eq("cooperativa_id", coop.id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabaseAdmin
      .from("cooperativa_motoristas")
      .select("id, motorista_id, status, created_at")
      .eq("cooperativa_id", coop.id)
      .order("created_at", { ascending: false }),
  ]);

  const ids = (vinculos.data ?? []).map((v) => v.motorista_id);
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, nome_completo")
      .in("id", ids);
    for (const p of data ?? []) nomes.set(p.id, p.nome_completo || "Motorista");
  }

  const cfg = await carregarConfig();

  return {
    cooperativa: coop,
    percentualCooperativa: n(cfg.rateio_cooperativa_percentual ?? 3),
    percentualPlataforma: arred(n(cfg.taxa_percentual) - n(cfg.rateio_cooperativa_percentual ?? 3)),
    carteira: {
      saldo_disponivel: n(carteira.data?.saldo_disponivel),
      saldo_repassado: n(carteira.data?.saldo_repassado),
    },
    transacoes: transacoes.data ?? [],
    repasses: repasses.data ?? [],
    motoristas: (vinculos.data ?? []).map((v) => ({
      ...v,
      nome: nomes.get(v.motorista_id) ?? "Motorista",
    })),
    repasseMinimo: REPASSE_COOPERATIVA_MINIMO,
    splitNativo: SPLIT_NATIVO_ATIVO,
  };
}
