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
