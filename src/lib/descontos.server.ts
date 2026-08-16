/**
 * Publicação e encerramento do desconto promocional da rota.
 *
 * Somente o motorista dono da rota, o frotista responsável ou o administrador
 * master podem publicar. Cada ato fica registrado na cadeia de blocos e os
 * passageiros com pré-reserva na saída recebem aviso do novo valor.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";
import {
  LIMITE_DESCONTO,
  aplicarDesconto,
  percentualValido,
  type DescontoRota,
  type Trecho,
  type TrechoDesconto,
} from "./descontos";

async function rotaAutorizada(rotaId: string, userId: string) {
  const { data: rota, error } = await supabaseAdmin
    .from("rotas")
    .select("id, user_id, origem, destino, preco_assento, frotista_id, saida_ida, saida_retorno")
    .eq("id", rotaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rota) throw new Error("Rota não encontrada.");

  if (rota.user_id === userId) return rota;

  const { data: master } = await supabaseAdmin.rpc("eh_admin_master", { _user_id: userId });
  if (master === true) return rota;

  if (rota.frotista_id) {
    const { data: frotista } = await supabaseAdmin
      .from("frotistas")
      .select("id")
      .eq("id", rota.frotista_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (frotista) return rota;
  }
  throw new Error("Somente o responsável pela rota pode publicar desconto.");
}

/** Descontos cadastrados na rota (inclusive encerrados), do mais recente. */
export async function descontosDaRota(rotaId: string): Promise<DescontoRota[]> {
  const { data, error } = await supabaseAdmin
    .from("rota_descontos")
    .select("id, rota_id, percentual, trecho, inicio, fim, ativo, observacao")
    .eq("rota_id", rotaId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DescontoRota[];
}

/** Descontos vigentes de várias rotas, para a vitrine do passageiro. */
export async function descontosVigentesDeRotas(rotaIds: string[]): Promise<DescontoRota[]> {
  if (rotaIds.length === 0) return [];
  const agora = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("rota_descontos")
    .select("id, rota_id, percentual, trecho, inicio, fim, ativo, observacao")
    .in("rota_id", rotaIds)
    .eq("ativo", true)
    .lte("inicio", agora);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DescontoRota[]).filter(
    (d) => !d.fim || new Date(d.fim).getTime() > Date.now(),
  );
}

export interface EntradaDesconto {
  userId: string;
  rotaId: string;
  percentual: number;
  trecho: TrechoDesconto;
  fim?: string | null;
  observacao?: string | null;
}

/** Publica o desconto e avisa quem já tem pré-reserva na saída. */
export async function publicarDesconto(dados: EntradaDesconto) {
  if (!percentualValido(dados.percentual)) {
    throw new Error(`Informe um desconto de 1% a ${LIMITE_DESCONTO}%.`);
  }
  const rota = await rotaAutorizada(dados.rotaId, dados.userId);

  // Um desconto vigente por rota: encerra os anteriores antes de publicar.
  await supabaseAdmin
    .from("rota_descontos")
    .update({ ativo: false, fim: new Date().toISOString() })
    .eq("rota_id", dados.rotaId)
    .eq("ativo", true);

  const { data: criado, error } = await supabaseAdmin
    .from("rota_descontos")
    .insert({
      rota_id: dados.rotaId,
      percentual: dados.percentual,
      trecho: dados.trecho,
      fim: dados.fim ?? null,
      observacao: dados.observacao ?? null,
      criado_por: dados.userId,
    })
    .select("id, rota_id, percentual, trecho, inicio, fim, ativo, observacao")
    .single();
  if (error) throw new Error(error.message);

  const precoNovo = aplicarDesconto(Number(rota.preco_assento) || 0, dados.percentual);

  const { data: interessados } = await supabaseAdmin
    .from("pre_reservas")
    .select("passageiro_id")
    .eq("rota_id", dados.rotaId)
    .in("status", ["aguardando", "ofertada"]);

  const ids = [...new Set((interessados ?? []).map((p) => p.passageiro_id))];
  if (ids.length > 0) {
    await supabaseAdmin.from("notificacoes").insert(
      ids.map((id) => ({
        user_id: id,
        titulo: `Promoção de ${dados.percentual}% na sua saída`,
        mensagem: `O motorista liberou ${dados.percentual}% de desconto em ${rota.origem} → ${rota.destino}. O assento sai por ${precoNovo.toFixed(2).replace(".", ",")} reais. Aproveite antes do fechamento da saída.`,
        tipo: "sucesso",
      })),
    );
  }

  await registrarEvento({
    evento: "desconto_promocional_publicado",
    registradoPor: dados.userId,
    dados: {
      rota: dados.rotaId,
      percentual: dados.percentual,
      trecho: dados.trecho,
      preco_original: Number(rota.preco_assento) || 0,
      preco_promocional: precoNovo,
      avisados: ids.length,
      fim: dados.fim ?? null,
    },
  });

  return { desconto: criado as unknown as DescontoRota, avisados: ids.length, precoNovo };
}

/** Encerra imediatamente o desconto vigente da rota. */
export async function encerrarDesconto(userId: string, rotaId: string) {
  await rotaAutorizada(rotaId, userId);
  const { error } = await supabaseAdmin
    .from("rota_descontos")
    .update({ ativo: false, fim: new Date().toISOString() })
    .eq("rota_id", rotaId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  await registrarEvento({
    evento: "desconto_promocional_encerrado",
    registradoPor: userId,
    dados: { rota: rotaId },
  });
  return { encerrado: true as const };
}

/** Percentual vigente do trecho, lido direto do banco (uso no servidor). */
export async function percentualVigente(rotaId: string, trecho: Trecho): Promise<number> {
  const { descontoVigente } = await import("./descontos");
  return descontoVigente(await descontosVigentesDeRotas([rotaId]), trecho);
}
