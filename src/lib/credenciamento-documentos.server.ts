import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import { MAX_DOCUMENTO_BYTES, TIPOS_ACEITOS, TIPOS_DOCUMENTO, type PerfilDocumento, type TipoDocumento } from "./credenciamento-documentos";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "documentos-credenciamento";

async function exigirMaster(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("eh_admin_master", { _user_id: userId });
  if (error || !data) throw new Error("Apenas o administrador master pode realizar esta ação.");
}

function decodificar(conteudo: string, mimeType: string) {
  if (!(TIPOS_ACEITOS as readonly string[]).includes(mimeType)) throw new Error("Envie JPG, PNG ou PDF.");
  const prefixo = `data:${mimeType};base64,`;
  if (!conteudo.startsWith(prefixo)) throw new Error("Arquivo inválido.");
  const bytes = Buffer.from(conteudo.slice(prefixo.length), "base64");
  if (bytes.byteLength < 100) throw new Error("Arquivo vazio ou inválido.");
  if (bytes.byteLength > MAX_DOCUMENTO_BYTES) throw new Error("O arquivo deve ter no máximo 8 MB.");
  return bytes;
}

function extensao(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

export async function salvarDocumentoCredenciamento(params: {
  userId: string;
  perfil: PerfilDocumento;
  tipo: TipoDocumento;
  nome: string;
  mimeType: string;
  conteudo: string;
}) {
  const permitidos = TIPOS_DOCUMENTO[params.perfil].map((item) => item.id as string);
  if (!permitidos.includes(params.tipo)) throw new Error("Este documento não pertence ao perfil selecionado.");
  const bytes = decodificar(params.conteudo, params.mimeType);
  const path = `${params.userId}/${params.perfil}/${params.tipo}-${Date.now()}.${extensao(params.mimeType)}`;
  const upload = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    contentType: params.mimeType,
    upsert: false,
  });
  if (upload.error) throw new Error("Não foi possível guardar o documento. Tente novamente.");

  const { data: anteriores } = await supabaseAdmin
    .from("credenciamento_documentos")
    .select("id, arquivo_path")
    .eq("user_id", params.userId)
    .eq("perfil", params.perfil)
    .eq("tipo", params.tipo)
    .neq("status", "excluido");

  if ((anteriores ?? []).length) {
    await supabaseAdmin
      .from("credenciamento_documentos")
      .update({ status: "excluido", motivo: "Substituído pelo titular." })
      .in("id", (anteriores ?? []).map((item) => item.id));
  }

  const { data, error } = await supabaseAdmin
    .from("credenciamento_documentos")
    .insert({
      user_id: params.userId,
      perfil: params.perfil,
      tipo: params.tipo,
      arquivo_path: path,
      nome_arquivo: params.nome,
      mime_type: params.mimeType,
      tamanho_bytes: bytes.byteLength,
      status: "em_analise",
    })
    .select("id, status")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data;
}

export async function obterUrlDocumento(solicitanteId: string, id: string) {
  const { data: ehMaster } = await supabaseAdmin.rpc("eh_admin_master", { _user_id: solicitanteId });
  const { data, error } = await supabaseAdmin
    .from("credenciamento_documentos")
    .select("user_id, arquivo_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Documento não encontrado.");
  if (data.user_id !== solicitanteId && !ehMaster) throw new Error("Você não pode abrir este documento.");
  const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.arquivo_path, 300);
  if (signed.error) throw new Error("Não foi possível abrir o documento.");
  return signed.data.signedUrl;
}

export async function listarCredenciamentos(adminId: string, termo = "") {
  await exigirMaster(adminId);
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["passageiro", "motorista"]);
  if (rolesError) throw rolesError;
  const ids = [...new Set((roles ?? []).map((item) => item.user_id))];
  if (!ids.length) return [];

  const [perfis, documentos, biometrias, habilitacoes, decisoes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome_completo, telefone").in("id", ids),
    supabaseAdmin.from("credenciamento_documentos").select("*").in("user_id", ids).neq("status", "excluido").order("created_at", { ascending: false }),
    supabaseAdmin.from("verificacoes_biometricas").select("id, user_id, perfil, status, motivo, qualidade, created_at").in("user_id", ids).order("created_at", { ascending: false }),
    supabaseAdmin.from("habilitacoes_motorista").select("id, user_id, numero, categoria, ear, validade, status, pendencias").in("user_id", ids),
    supabaseAdmin.from("credenciamento_decisoes").select("*").in("user_id", ids).order("created_at", { ascending: false }),
  ]);
  const emails = new Map<string, string>();
  const auth = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const usuario of auth.data?.users ?? []) emails.set(usuario.id, usuario.email ?? "");
  const busca = termo.trim().toLocaleLowerCase("pt-BR");

  return ids.map((userId) => {
    const rolesUsuario = (roles ?? []).filter((item) => item.user_id === userId).map((item) => item.role);
    const perfil = perfis.data?.find((item) => item.id === userId);
    return {
      userId,
      nome: perfil?.nome_completo || "Usuário",
      email: emails.get(userId) ?? "",
      telefone: perfil?.telefone ?? null,
      perfis: rolesUsuario,
      documentos: (documentos.data ?? []).filter((item) => item.user_id === userId),
      biometrias: (biometrias.data ?? []).filter((item) => item.user_id === userId),
      habilitacao: (habilitacoes.data ?? []).find((item) => item.user_id === userId) ?? null,
      decisoes: (decisoes.data ?? []).filter((item) => item.user_id === userId),
    };
  }).filter((item) => !busca || item.nome.toLocaleLowerCase("pt-BR").includes(busca) || item.email.toLowerCase().includes(busca));
}

const ORDEM = ["biometria", "documentos", "cnh", "veiculo"] as const;

export async function aplicarDecisaoCredenciamento(params: {
  adminId: string;
  userId: string;
  perfil: PerfilDocumento;
  etapa: "biometria" | "documentos" | "cnh" | "veiculo" | "total";
  acao: "aprovar" | "correcao" | "rejeitar" | "excluir" | "reiniciar";
  motivo: string;
}) {
  await exigirMaster(params.adminId);
  const motivo = params.motivo.trim();
  if (motivo.length < 10) throw new Error("Informe uma justificativa com pelo menos 10 caracteres.");

  const inicio = params.etapa === "total" ? 0 : ORDEM.indexOf(params.etapa as (typeof ORDEM)[number]);
  const afetadas = params.acao === "reiniciar" || params.acao === "excluir"
    ? ORDEM.slice(Math.max(0, inicio))
    : [params.etapa];
  const estadoAnterior: Record<string, unknown> = {};

  if (afetadas.includes("biometria")) {
    const atual = await supabaseAdmin.from("verificacoes_biometricas").select("id, status").eq("user_id", params.userId);
    estadoAnterior["biometria"] = atual.data ?? [];
    if (params.acao === "excluir") {
      await supabaseAdmin.from("verificacoes_biometricas").delete().eq("user_id", params.userId);
    } else if (params.acao !== "aprovar") {
      await supabaseAdmin.from("verificacoes_biometricas").update({ status: params.acao === "rejeitar" ? "reprovada" : "em_analise", motivo }).eq("user_id", params.userId);
    }
  }
  if (afetadas.includes("documentos")) {
    const atual = await supabaseAdmin.from("credenciamento_documentos").select("id, status").eq("user_id", params.userId).neq("status", "excluido");
    estadoAnterior["documentos"] = atual.data ?? [];
    if (params.acao === "excluir") {
      const arquivos = (atual.data ?? []).map((item) => item.id);
      const paths = await supabaseAdmin.from("credenciamento_documentos").select("arquivo_path").in("id", arquivos);
      if ((paths.data ?? []).length) await supabaseAdmin.storage.from(BUCKET).remove((paths.data ?? []).map((item) => item.arquivo_path));
      if (arquivos.length) await supabaseAdmin.from("credenciamento_documentos").delete().in("id", arquivos);
    } else {
      const status = params.acao === "aprovar" ? "aprovado" : params.acao === "rejeitar" ? "rejeitado" : "correcao";
      await supabaseAdmin.from("credenciamento_documentos").update({ status, motivo, decidido_por: params.adminId, decidido_em: new Date().toISOString() }).eq("user_id", params.userId).neq("status", "excluido");
    }
  }
  if (afetadas.includes("cnh")) {
    const atual = await supabaseAdmin.from("habilitacoes_motorista").select("id, status").eq("user_id", params.userId);
    estadoAnterior["cnh"] = atual.data ?? [];
    if (params.acao === "excluir") {
      await supabaseAdmin.from("habilitacoes_motorista").delete().eq("user_id", params.userId);
    } else if (params.acao !== "aprovar") {
      await supabaseAdmin.from("habilitacoes_motorista").update({ status: params.acao === "rejeitar" ? "reprovado" : "pendente", pendencias: [motivo] }).eq("user_id", params.userId);
    }
  }
  if (afetadas.includes("veiculo")) {
    const atual = await supabaseAdmin.from("veiculos").select("id, status_verificacao").eq("user_id", params.userId);
    estadoAnterior["veiculo"] = atual.data ?? [];
    if (params.acao === "excluir") {
      await supabaseAdmin.from("veiculos").delete().eq("user_id", params.userId);
    } else {
      await supabaseAdmin.from("veiculos").update({ status_verificacao: params.acao === "rejeitar" ? "reprovado" : "pendente" }).eq("user_id", params.userId);
    }
  }
  if (params.acao === "reiniciar" || params.acao === "excluir") {
    await supabaseAdmin.from("credenciamento_liberacoes").update({ revogado_em: new Date().toISOString(), revogado_por: params.adminId }).eq("user_id", params.userId).is("revogado_em", null);
  }

  const { error } = await supabaseAdmin.from("credenciamento_decisoes").insert({
    user_id: params.userId,
    perfil: params.perfil,
    etapa: params.etapa,
    acao: params.acao,
    motivo,
    decidido_por: params.adminId,
    estado_anterior: estadoAnterior as Json,
    estado_novo: { etapas_afetadas: afetadas },
  });
  if (error) throw new Error(error.message);
  await registrarEvento({ evento: `credenciamento_${params.acao}`, registradoPor: params.adminId, dados: { usuario: params.userId, perfil: params.perfil, etapa: params.etapa, motivo, etapas_afetadas: afetadas } });
  return { ok: true, etapasAfetadas: afetadas };
}
