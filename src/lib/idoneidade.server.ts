import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { registrarEvento } from "./blockchain.server";
import {
  avaliarPessoa,
  avaliarVeiculo,
  somenteDigitos,
  type AlvoVerificacao,
  type AvaliacaoIdoneidade,
} from "./idoneidade";

export interface EntradaVerificacao {
  alvo: AlvoVerificacao;
  userId: string;
  documento: string;
  nome?: string | undefined;
  cnh?: string | undefined;
  dataNascimento?: string | undefined;
  veiculoId?: string | undefined;
}

interface RespostaProvedor {
  provedor: string;
  pendencias: string[];
  bloqueado: boolean;
  bruto: Json | null;
}

/**
 * Adaptador de consulta externa. Enquanto as credenciais do birô não estiverem
 * configuradas, a plataforma opera apenas com as validações determinísticas
 * locais e registra o provedor como "local".
 */
async function consultarProvedorExterno(
  entrada: EntradaVerificacao,
  extra: Record<string, unknown>,
): Promise<RespostaProvedor | null> {
  const url = process.env["IDONEIDADE_API_URL"];
  const chave = process.env["IDONEIDADE_API_KEY"];
  if (!url || !chave) return null;

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        alvo: entrada.alvo,
        documento: somenteDigitos(entrada.documento),
        nome: entrada.nome,
        cnh: entrada.cnh ? somenteDigitos(entrada.cnh) : undefined,
        data_nascimento: entrada.dataNascimento,
        ...extra,
      }),
    });
    if (!resposta.ok) {
      return {
        provedor: "externo",
        pendencias: [`Consulta externa indisponível (HTTP ${resposta.status}).`],
        bloqueado: false,
        bruto: null,
      };
    }
    const corpo = (await resposta.json()) as {
      pendencias?: string[];
      restricoes?: string[];
      bloqueado?: boolean;
    };
    return {
      provedor: "externo",
      pendencias: [...(corpo.pendencias ?? []), ...(corpo.restricoes ?? [])],
      bloqueado: !!corpo.bloqueado,
      bruto: corpo as Json,
    };
  } catch (e) {
    return {
      provedor: "externo",
      pendencias: [`Falha ao consultar o provedor externo: ${(e as Error).message}`],
      bloqueado: false,
      bruto: null,
    };
  }
}

export async function verificarIdoneidade(entrada: EntradaVerificacao) {
  let local: AvaliacaoIdoneidade;
  let extra: Record<string, unknown> = {};

  if (entrada.alvo === "veiculo") {
    if (!entrada.veiculoId) throw new Error("Selecione o veículo a verificar.");
    const { data: veiculo, error } = await supabaseAdmin
      .from("veiculos")
      .select("*")
      .eq("id", entrada.veiculoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!veiculo) throw new Error("Veículo não encontrado.");
    // Só o proprietário do veículo (ou a gestão) pode disparar a verificação.
    if (veiculo.user_id !== entrada.userId) {
      const { data: admin } = await supabaseAdmin.rpc("has_role", {
        _user_id: entrada.userId,
        _role: "admin",
      });
      if (!admin) throw new Error("Você não tem permissão para verificar este veículo.");
    }

    local = avaliarVeiculo({
      placa: veiculo.placa,
      ano: veiculo.ano,
      renavam: veiculo.renavam,
      chassi: veiculo.chassi,
      assentos: veiculo.assentos,
      crlv_exercicio: veiculo.crlv_exercicio,
      crlv_situacao: veiculo.crlv_situacao,
    });
    extra = { placa: veiculo.placa, renavam: veiculo.renavam, chassi: veiculo.chassi };
  } else {
    local = avaliarPessoa(entrada.alvo, {
      documento: entrada.documento,
      nome: entrada.nome,
      cnh: entrada.cnh,
      dataNascimento: entrada.dataNascimento,
    });
  }

  const externo = await consultarProvedorExterno(entrada, extra);
  const pendencias = [...local.pendencias, ...(externo?.pendencias ?? [])];
  const bloqueado = local.status === "reprovado" || !!externo?.bloqueado;
  const status = bloqueado ? "reprovado" : pendencias.length ? "em_analise" : "aprovado";
  const pontuacao = Math.max(
    0,
    Math.min(100, local.pontuacao - (externo?.pendencias.length ?? 0) * 12 - (externo?.bloqueado ? 30 : 0)),
  );

  const expira = new Date();
  expira.setMonth(expira.getMonth() + 6);

  const { data: registro, error } = await supabaseAdmin
    .from("verificacoes_idoneidade")
    .insert({
      alvo: entrada.alvo,
      user_id: entrada.userId,
      veiculo_id: entrada.veiculoId ?? null,
      documento: somenteDigitos(entrada.documento),
      nome_conferido: entrada.nome ?? null,
      provedor: externo?.provedor ?? "local",
      status,
      pontuacao,
      pendencias,
      resultado: {
        validacoes_locais: {
          status: local.status,
          pontuacao: local.pontuacao,
          pendencias: local.pendencias,
        },
        consulta_externa: externo?.bruto ?? null,
      },
      consultado_em: new Date().toISOString(),
      expira_em: status === "aprovado" ? expira.toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (entrada.alvo === "veiculo" && entrada.veiculoId) {
    await supabaseAdmin
      .from("veiculos")
      .update({ status_verificacao: status, updated_at: new Date().toISOString() })
      .eq("id", entrada.veiculoId);
  }

  await registrarEvento({
    evento: "verificacao_idoneidade",
    registradoPor: entrada.userId,
    dados: {
      verificacao: registro.id,
      alvo: entrada.alvo,
      provedor: externo?.provedor ?? "local",
      status,
      pontuacao,
      pendencias,
    },
  });

  return { id: registro.id, status, pontuacao, pendencias, provedor: externo?.provedor ?? "local" };
}
