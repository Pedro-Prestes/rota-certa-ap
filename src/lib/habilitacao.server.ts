import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import { avaliarHabilitacao, type DadosHabilitacao } from "./habilitacao";
import { somenteDigitos } from "./idoneidade";

/** Fase 1: idoneidade do motorista aprovada + biometria facial aprovada. */
export async function fase1Aprovada(userId: string) {
  const [idoneidade, biometria] = await Promise.all([
    supabaseAdmin
      .from("verificacoes_idoneidade")
      .select("id")
      .eq("user_id", userId)
      .eq("alvo", "motorista")
      .eq("status", "aprovado")
      .limit(1),
    supabaseAdmin
      .from("verificacoes_biometricas")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "aprovada")
      .limit(1),
  ]);
  return (idoneidade.data ?? []).length > 0 && (biometria.data ?? []).length > 0;
}

export async function registrarHabilitacao(params: { userId: string } & DadosHabilitacao) {
  if (!(await fase1Aprovada(params.userId))) {
    throw new Error(
      "Conclua a fase 1 (idoneidade do motorista e biometria facial aprovadas) antes de cadastrar a CNH.",
    );
  }

  const avaliacao = avaliarHabilitacao(params);

  const { data: registro, error } = await supabaseAdmin
    .from("habilitacoes_motorista")
    .upsert(
      {
        user_id: params.userId,
        numero: somenteDigitos(params.numero),
        categoria: (params.categoria || "").toUpperCase(),
        ear: !!params.ear,
        validade: params.validade || null,
        primeira_habilitacao: params.primeiraHabilitacao || null,
        status: avaliacao.status,
        pendencias: [...avaliacao.pendencias, ...avaliacao.avisos],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await registrarEvento({
    evento: "habilitacao_motorista",
    registradoPor: params.userId,
    dados: {
      habilitacao: registro.id,
      categoria: (params.categoria || "").toUpperCase(),
      ear: !!params.ear,
      validade: params.validade ?? null,
      status: avaliacao.status,
      pendencias: avaliacao.pendencias,
    },
  });

  return {
    id: registro.id,
    status: avaliacao.status,
    pendencias: avaliacao.pendencias,
    avisos: avaliacao.avisos,
  };
}
