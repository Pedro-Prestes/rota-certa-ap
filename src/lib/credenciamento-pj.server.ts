/**
 * Credenciamento em 3 fases de Cooperativas e Frotistas — camada de servidor.
 *
 * Recebe os documentos da empresa, avalia automaticamente, atualiza a fase e o
 * score de conformidade da entidade e registra o evento na cadeia de blocos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import {
  avaliarDocumentoPJ,
  situacaoPJ,
  type DocumentoPJ,
  type EntradaDocumentoPJ,
  type TipoEntidadePJ,
} from "./credenciamento-pj";

const tabela = (tipo: TipoEntidadePJ) => (tipo === "cooperativa" ? "cooperativas" : "frotistas");

/** Entidade da PJ pertencente ao usuário (responsável legal). */
export async function entidadeDoResponsavel(tipo: TipoEntidadePJ, userId: string) {
  const { data } = await supabaseAdmin
    .from(tabela(tipo))
    .select("id, user_id, cnpj, razao_social, status, fase_atual, score_conformidade, verificada")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as {
    id: string;
    user_id: string;
    cnpj: string;
    razao_social: string;
    status: string;
    fase_atual: number;
    score_conformidade: number;
    verificada: boolean;
  } | null;
}

async function biometriaAprovada(userId: string) {
  const { data } = await supabaseAdmin
    .from("verificacoes_biometricas")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "aprovada")
    .limit(1);
  return (data ?? []).length > 0;
}

async function documentos(tipo: TipoEntidadePJ, entidadeId: string) {
  const { data } = await supabaseAdmin
    .from("pj_conformidade")
    .select("id, tipo_documento, numero, orgao_emissor, validade, status, pendencias, observacao")
    .eq("tipo_entidade", tipo)
    .eq("entidade_id", entidadeId);
  return ((data ?? []) as unknown as DocumentoPJ[]).map((d) => ({
    ...d,
    pendencias: Array.isArray(d.pendencias) ? d.pendencias : [],
  }));
}

/** Recalcula fase, score e selo de verificação da entidade. */
export async function sincronizarSituacao(tipo: TipoEntidadePJ, entidadeId: string, userId: string) {
  const [docs, bio] = await Promise.all([documentos(tipo, entidadeId), biometriaAprovada(userId)]);
  const situacao = situacaoPJ({ tipoEntidade: tipo, documentos: docs, biometriaOk: bio });

  await supabaseAdmin
    .from(tabela(tipo))
    .update({
      fase_atual: situacao.faseAtual,
      score_conformidade: situacao.score,
      verificada: situacao.verificada,
      avaliada_em: new Date().toISOString(),
    })
    .eq("id", entidadeId);

  return { documentos: docs, biometriaOk: bio, situacao };
}

/** Painel de credenciamento da PJ. */
export async function painelCredenciamentoPJ(tipo: TipoEntidadePJ, userId: string) {
  const entidade = await entidadeDoResponsavel(tipo, userId);
  if (!entidade) return { entidade: null, documentos: [], biometriaOk: false, situacao: null };
  const { documentos: docs, biometriaOk, situacao } = await sincronizarSituacao(
    tipo,
    entidade.id,
    userId,
  );
  return { entidade, documentos: docs, biometriaOk, situacao };
}

/** Envia (ou substitui) um documento de conformidade da empresa. */
export async function enviarDocumentoPJ(params: {
  tipo: TipoEntidadePJ;
  userId: string;
  entrada: EntradaDocumentoPJ;
}) {
  const entidade = await entidadeDoResponsavel(params.tipo, params.userId);
  if (!entidade) throw new Error("Cadastre a empresa antes de enviar documentos.");

  const avaliacao = avaliarDocumentoPJ(params.tipo, params.entrada, entidade.cnpj);

  const { error } = await supabaseAdmin.from("pj_conformidade").upsert(
    {
      tipo_entidade: params.tipo,
      entidade_id: entidade.id,
      user_id: params.userId,
      tipo_documento: params.entrada.tipo_documento,
      numero: params.entrada.numero?.trim() || null,
      orgao_emissor: params.entrada.orgao_emissor?.trim() || null,
      validade: params.entrada.validade || null,
      status: avaliacao.status,
      pendencias: avaliacao.pendencias,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tipo_entidade,entidade_id,tipo_documento" },
  );
  if (error) throw new Error(error.message);

  const resultado = await sincronizarSituacao(params.tipo, entidade.id, params.userId);

  await registrarEvento({
    evento: "credenciamento_pj",
    registradoPor: params.userId,
    dados: {
      tipo_entidade: params.tipo,
      entidade: entidade.id,
      documento: params.entrada.tipo_documento,
      status: avaliacao.status,
      fase: resultado.situacao.faseAtual,
      score: resultado.situacao.score,
    },
  });

  return { avaliacao, ...resultado };
}

/** Semáforo de conformidade dos condutores vinculados à cooperativa. */
export async function conformidadeMotoristasCooperativa(cooperativaId: string) {
  const { data: vinculos } = await supabaseAdmin
    .from("cooperativa_motoristas")
    .select("motorista_id, status")
    .eq("cooperativa_id", cooperativaId);

  const ids = (vinculos ?? []).map((v) => v.motorista_id);
  if (!ids.length) return [];

  const [perfis, habilitacoes, biometrias] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome_completo").in("id", ids),
    supabaseAdmin
      .from("habilitacoes_motorista")
      .select("user_id, categoria, ear, validade, status")
      .in("user_id", ids),
    supabaseAdmin
      .from("verificacoes_biometricas")
      .select("user_id, status")
      .in("user_id", ids)
      .eq("status", "aprovada"),
  ]);

  const nome = new Map((perfis.data ?? []).map((p) => [p.id, p.nome_completo]));
  const cnh = new Map((habilitacoes.data ?? []).map((h) => [h.user_id, h]));
  const bio = new Set((biometrias.data ?? []).map((b) => b.user_id));

  return ids.map((id) => {
    const h = cnh.get(id);
    return {
      motorista_id: id,
      nome: nome.get(id) || "Motorista",
      status: (vinculos ?? []).find((v) => v.motorista_id === id)?.status ?? "inativo",
      biometriaOk: bio.has(id),
      cnhStatus: h?.status ?? null,
      cnhCategoria: h?.categoria ?? null,
      cnhEar: h?.ear ?? false,
      cnhValidade: h?.validade ?? null,
    };
  });
}

/* --------------------------------------------- autorização do admin master */

/** Somente o administrador master decide o credenciamento das empresas. */
async function exigirMaster(userId: string) {
  const { data } = await supabaseAdmin.rpc("eh_admin_master", { _user_id: userId });
  if (!data) throw new Error("Apenas o administrador master pode autorizar o credenciamento.");
}

export interface ItemFilaPJ extends DocumentoPJ {
  tipo_entidade: TipoEntidadePJ;
  entidade_id: string;
  empresa: string;
  cnpj: string;
  responsavel: string;
  decidido_em: string | null;
  motivo_reprovacao: string | null;
  created_at: string;
}

/** Fila de análise do credenciamento das cooperativas e frotistas. */
export async function filaCredenciamentoPJ(adminId: string): Promise<ItemFilaPJ[]> {
  await exigirMaster(adminId);

  const { data } = await supabaseAdmin
    .from("pj_conformidade")
    .select(
      "id, tipo_entidade, entidade_id, user_id, tipo_documento, numero, orgao_emissor, validade, status, pendencias, observacao, motivo_reprovacao, decidido_em, created_at",
    )
    .order("created_at", { ascending: true });

  const itens = (data ?? []) as unknown as (ItemFilaPJ & { user_id: string })[];
  if (!itens.length) return [];

  const coopIds = itens.filter((i) => i.tipo_entidade === "cooperativa").map((i) => i.entidade_id);
  const frotIds = itens.filter((i) => i.tipo_entidade === "frotista").map((i) => i.entidade_id);

  const [coops, frots, perfis] = await Promise.all([
    coopIds.length
      ? supabaseAdmin.from("cooperativas").select("id, razao_social, cnpj").in("id", coopIds)
      : Promise.resolve({ data: [] as { id: string; razao_social: string; cnpj: string }[] }),
    frotIds.length
      ? supabaseAdmin.from("frotistas").select("id, razao_social, cnpj").in("id", frotIds)
      : Promise.resolve({ data: [] as { id: string; razao_social: string; cnpj: string }[] }),
    supabaseAdmin.from("profiles").select("id, nome_completo").in("id", itens.map((i) => i.user_id)),
  ]);

  const empresas = new Map(
    [...(coops.data ?? []), ...(frots.data ?? [])].map((e) => [e.id, e]),
  );
  const nomes = new Map((perfis.data ?? []).map((p) => [p.id, p.nome_completo]));

  return itens.map((i) => ({
    ...i,
    pendencias: Array.isArray(i.pendencias) ? i.pendencias : [],
    empresa: empresas.get(i.entidade_id)?.razao_social ?? "Empresa",
    cnpj: empresas.get(i.entidade_id)?.cnpj ?? "",
    responsavel: nomes.get(i.user_id) || "Responsável legal",
  }));
}

/**
 * Aprova ou reprova um documento de credenciamento. A entrada da empresa em
 * operação (fase 3) depende exclusivamente desta autorização.
 */
export async function decidirDocumentoPJ(params: {
  adminId: string;
  documentoId: string;
  decisao: "aprovado" | "reprovado";
  motivo?: string;
}) {
  await exigirMaster(params.adminId);

  if (params.decisao === "reprovado" && !(params.motivo ?? "").trim()) {
    throw new Error("Informe o motivo da reprovação.");
  }

  const { data: doc, error: erroDoc } = await supabaseAdmin
    .from("pj_conformidade")
    .select("id, tipo_entidade, entidade_id, user_id, tipo_documento")
    .eq("id", params.documentoId)
    .maybeSingle();
  if (erroDoc) throw new Error(erroDoc.message);
  if (!doc) throw new Error("Documento não encontrado.");

  const { error } = await supabaseAdmin
    .from("pj_conformidade")
    .update({
      status: params.decisao,
      motivo_reprovacao: params.decisao === "reprovado" ? params.motivo!.trim() : null,
      pendencias: params.decisao === "reprovado" ? [params.motivo!.trim()] : [],
      decidido_por: params.adminId,
      decidido_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.documentoId);
  if (error) throw new Error(error.message);

  const tipo = doc.tipo_entidade as TipoEntidadePJ;
  const resultado = await sincronizarSituacao(tipo, doc.entidade_id, doc.user_id);

  await registrarEvento({
    evento: "credenciamento_pj_decisao",
    registradoPor: params.adminId,
    dados: {
      tipo_entidade: tipo,
      entidade: doc.entidade_id,
      documento: doc.tipo_documento,
      decisao: params.decisao,
      motivo: params.motivo?.trim() || null,
      fase: resultado.situacao.faseAtual,
      score: resultado.situacao.score,
    },
  });

  return { ok: true, situacao: resultado.situacao };
}
