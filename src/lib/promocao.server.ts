/**
 * Lançamento promocional: 1 mês grátis do Motorista Pro para os 10 primeiros
 * motoristas que publicarem uma rota em cada estado brasileiro.
 *
 * A vaga é definida pela UF de origem da primeira rota publicada e reservada
 * por um insert com posição única por UF (evita corrida entre cadastros
 * simultâneos). O prêmio é uma assinatura de carteira marcada como
 * `promocional`, sem débito de créditos e sem renovação automática.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import { assinaturaVigente } from "./assinatura.server";
import { assinaturaCarteiraVigente } from "./assinatura-carteira.server";
import { precoPorId, planoDoPrice } from "./planos";
import { normalizarUf } from "./ufs";

const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

export interface PromoConfig {
  id: string;
  vagas_por_uf: number;
  price_id: string;
  dias: number;
  ativa: boolean;
  vigencia_inicio: string;
  vigencia_fim: string | null;
}

export async function promoConfig(): Promise<PromoConfig | null> {
  const { data } = await supabaseAdmin
    .from("promo_config")
    .select("id, vagas_por_uf, price_id, dias, ativa, vigencia_inicio, vigencia_fim")
    .eq("chave", "lancamento_motorista")
    .maybeSingle();
  return (data as PromoConfig | null) ?? null;
}

function campanhaAberta(cfg: PromoConfig | null): cfg is PromoConfig {
  if (!cfg || !cfg.ativa) return false;
  const agora = Date.now();
  if (new Date(cfg.vigencia_inicio).getTime() > agora) return false;
  if (cfg.vigencia_fim && new Date(cfg.vigencia_fim).getTime() < agora) return false;
  return true;
}

export interface VagaUf {
  uf: string;
  usadas: number;
  restantes: number;
}

/** Vagas restantes por UF, além do estado geral da campanha. */
export async function vagasRestantes(): Promise<{
  ativa: boolean;
  vagasPorUf: number;
  dias: number;
  ufs: VagaUf[];
}> {
  const cfg = await promoConfig();
  const { data } = await supabaseAdmin.rpc("promo_vagas_restantes");
  const ufs = ((data ?? []) as VagaUf[]).map((v) => ({
    uf: v.uf,
    usadas: Number(v.usadas),
    restantes: Number(v.restantes),
  }));
  return {
    ativa: campanhaAberta(cfg),
    vagasPorUf: cfg?.vagas_por_uf ?? 10,
    dias: cfg?.dias ?? 30,
    ufs,
  };
}

export async function promoDoUsuario(userId: string) {
  const { data } = await supabaseAdmin
    .from("promo_lancamento")
    .select("id, uf, posicao, status, concedida_em, expira_em")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** Lista de premiados (uso administrativo). */
export async function premiados() {
  const { data } = await supabaseAdmin
    .from("promo_lancamento")
    .select("id, uf, posicao, user_id, status, concedida_em, expira_em")
    .order("concedida_em", { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function definirCampanhaAtiva(ativa: boolean) {
  const cfg = await promoConfig();
  if (!cfg) throw new Error("Campanha promocional não configurada.");
  await supabaseAdmin
    .from("promo_config")
    .update({ ativa, updated_at: new Date().toISOString() })
    .eq("id", cfg.id);
  return { ativa };
}

export type ResultadoPromo =
  | { concedida: true; uf: string; posicao: number; expiraEm: string; plano: string }
  | { concedida: false; motivo: string };

/**
 * Concede o mês de cortesia quando o motorista publica a primeira rota em uma
 * UF com vaga disponível. Nunca lança erro para não bloquear o cadastro.
 */
export async function concederPromoPrimeiraRota(dados: {
  userId: string;
  rotaId: string;
  uf: string;
  environment: StripeEnv;
}): Promise<ResultadoPromo> {
  try {
    const uf = normalizarUf(dados.uf);
    if (!uf) return { concedida: false, motivo: "Estado inválido." };

    const cfg = await promoConfig();
    if (!campanhaAberta(cfg)) return { concedida: false, motivo: "Campanha encerrada." };

    const preco = precoPorId(cfg.price_id);
    const plano = planoDoPrice(cfg.price_id);
    if (!preco || !plano) return { concedida: false, motivo: "Plano promocional inválido." };

    // A cortesia é da primeira rota publicada pelo próprio motorista.
    const { data: rota } = await supabaseAdmin
      .from("rotas")
      .select("id, user_id")
      .eq("id", dados.rotaId)
      .maybeSingle();
    if (!rota || rota.user_id !== dados.userId) {
      return { concedida: false, motivo: "Rota não encontrada para esta conta." };
    }

    const jaTem = await promoDoUsuario(dados.userId);
    if (jaTem) return { concedida: false, motivo: "Benefício já utilizado." };


    const [stripeSub, carteiraSub] = await Promise.all([
      assinaturaVigente(dados.userId, dados.environment),
      assinaturaCarteiraVigente(dados.userId, dados.environment),
    ]);
    if (stripeSub || carteiraSub) return { concedida: false, motivo: "Você já tem um plano ativo." };

    const { count } = await supabaseAdmin
      .from("promo_lancamento")
      .select("id", { count: "exact", head: true })
      .eq("uf", uf);
    const usadas = count ?? 0;
    if (usadas >= cfg.vagas_por_uf) return { concedida: false, motivo: "Vagas esgotadas neste estado." };

    const inicio = new Date();
    const fim = new Date(inicio.getTime() + cfg.dias * 24 * 60 * 60 * 1000);

    // Reserva a vaga: a posição é única por UF, então concorrentes falham aqui.
    let posicao = usadas + 1;
    let reservaId: string | null = null;
    for (let tentativa = 0; tentativa < cfg.vagas_por_uf && posicao <= cfg.vagas_por_uf; tentativa += 1) {
      const { data, error } = await supabaseAdmin
        .from("promo_lancamento")
        .insert({
          uf,
          user_id: dados.userId,
          rota_id: dados.rotaId,
          posicao,
          environment: dados.environment,
          expira_em: fim.toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (data?.id) {
        reservaId = data.id;
        break;
      }
      // Conflito em (uf, posicao): tenta a próxima. Conflito em user_id: sai.
      if (error?.message?.includes("promo_lancamento_user_key")) {
        return { concedida: false, motivo: "Benefício já utilizado." };
      }
      posicao += 1;
    }
    if (!reservaId) return { concedida: false, motivo: "Vagas esgotadas neste estado." };

    const { data: assinatura } = await supabaseAdmin
      .from("assinaturas_carteira")
      .insert({
        user_id: dados.userId,
        price_id: cfg.price_id,
        valor_mensal: preco.valor,
        status: "ativa",
        promocional: true,
        periodo_inicio: inicio.toISOString(),
        periodo_fim: fim.toISOString(),
        proxima_cobranca: fim.toISOString(),
        // Cortesia não renova sozinha: o motorista assina se quiser continuar.
        cancelar_no_fim: true,
        environment: dados.environment,
      })
      .select("id")
      .single();

    await supabaseAdmin
      .from("promo_lancamento")
      .update({ assinatura_id: assinatura?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", reservaId);

    await supabaseAdmin.from("lancamentos_contabeis").insert({
      tipo: "ajuste",
      valor: preco.valor,
      descricao: `Cortesia de lançamento — ${plano.nome} (${uf}, vaga ${posicao})`,
      competencia: competencia(),
      detalhamento: {
        origem: "promo_lancamento",
        uf,
        posicao,
        promocao: reservaId,
        assinatura: assinatura?.id ?? null,
        ambiente: dados.environment,
      },
    });

    await supabaseAdmin.from("notificacoes").insert({
      user_id: dados.userId,
      titulo: `${plano.nome} liberado por ${cfg.dias} dias`,
      mensagem: `Você é o ${posicao}º motorista de ${uf} no lançamento da RotaCerta e ganhou uma mensalidade do ${plano.nome} sem custo. A taxa administrativa das suas corridas cai para ${plano.taxa.taxa_percentual}% + R$ ${plano.taxa.taxa_fixa.toFixed(2)} até ${fim.toLocaleDateString("pt-BR")}. Não há cobrança automática no fim do período.`,
      tipo: "sucesso",
    });

    await registrarEvento({
      evento: "promo_lancamento_concedida",
      registradoPor: dados.userId,
      dados: {
        promocao: reservaId,
        uf,
        posicao,
        rota: dados.rotaId,
        plano: cfg.price_id,
        expira_em: fim.toISOString(),
        ambiente: dados.environment,
      },
    });

    return { concedida: true, uf, posicao, expiraEm: fim.toISOString(), plano: plano.nome };
  } catch (e) {
    console.error("Falha ao conceder a cortesia de lançamento:", e);
    return { concedida: false, motivo: "Não foi possível avaliar a promoção agora." };
  }
}

/**
 * Rotina diária: avisa 3 dias antes do fim da cortesia e encerra no vencimento.
 * Chamada junto da renovação das assinaturas de carteira.
 */
export async function processarCortesias(env: StripeEnv) {
  const agora = new Date();
  const resultado = { avisadas: 0, encerradas: 0 };

  const { data: ativas } = await supabaseAdmin
    .from("assinaturas_carteira")
    .select("id, user_id, price_id, periodo_fim, status")
    .eq("environment", env)
    .eq("promocional", true)
    .eq("status", "ativa")
    .limit(500);

  const limiteAviso = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);

  for (const sub of (ativas ?? []) as Array<{
    id: string;
    user_id: string;
    price_id: string;
    periodo_fim: string;
  }>) {
    const fim = new Date(sub.periodo_fim);
    const plano = planoDoPrice(sub.price_id);

    if (fim <= agora) {
      await supabaseAdmin
        .from("assinaturas_carteira")
        .update({ status: "cancelada", updated_at: agora.toISOString() })
        .eq("id", sub.id);
      await supabaseAdmin
        .from("promo_lancamento")
        .update({ status: "encerrada", updated_at: agora.toISOString() })
        .eq("assinatura_id", sub.id);
      await supabaseAdmin.from("notificacoes").insert({
        user_id: sub.user_id,
        titulo: "Cortesia de lançamento encerrada",
        mensagem: `Seu mês gratuito do ${plano?.nome ?? "plano"} terminou e nenhum valor foi cobrado. Para manter a taxa administrativa reduzida, assine o plano em Planos e créditos.`,
        tipo: "alerta",
      });
      resultado.encerradas += 1;
      continue;
    }

    if (fim <= limiteAviso) {
      const { data: aviso } = await supabaseAdmin
        .from("notificacoes")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("titulo", "Sua cortesia de lançamento está acabando")
        .limit(1)
        .maybeSingle();
      if (aviso) continue;
      await supabaseAdmin.from("notificacoes").insert({
        user_id: sub.user_id,
        titulo: "Sua cortesia de lançamento está acabando",
        mensagem: `Seu mês gratuito do ${plano?.nome ?? "plano"} vale até ${fim.toLocaleDateString("pt-BR")}. Compre créditos por Pix e assine para continuar com a taxa administrativa reduzida.`,
        tipo: "info",
      });
      resultado.avisadas += 1;
    }
  }

  return resultado;
}
