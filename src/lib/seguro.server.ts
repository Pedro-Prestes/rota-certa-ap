import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, type StripeEnv } from "./stripe.server";
import { registrarEvento } from "./blockchain.server";
import {
  DIAS_COBERTURA_MENSAL,
  PRICE_PROTECAO_AVULSA,
  PRICE_PROTECAO_MENSAL,
  VALOR_PROTECAO_ASSENTO,
  VALOR_PROTECAO_MENSAL,
  podeTransicionar,
  valorProtecaoAvulsa,
  type ModalidadeCobertura,
  type StatusSinistro,
} from "./seguro";

const arred = (v: number) => Math.round(v * 100) / 100;
const competencia = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;
const reais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

async function notificar(
  userId: string,
  titulo: string,
  mensagem: string,
  tipo: "info" | "sucesso" | "alerta" = "info",
) {
  await supabaseAdmin.from("notificacoes").insert({ user_id: userId, titulo, mensagem, tipo });
}

/** Passageiros com ponto de embarque acordado naquela saída. */
async function passageirosDaSaida(rotaId: string, dataViagem: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("pontos_embarque")
    .select("passageiro_id")
    .eq("rota_id", rotaId)
    .eq("data_viagem", dataViagem)
    .eq("status", "aceito");
  return [...new Set((data ?? []).map((p) => p.passageiro_id))];
}

async function notificarSaida(
  rotaId: string,
  dataViagem: string,
  titulo: string,
  mensagem: string,
  tipo: "info" | "sucesso" | "alerta" = "info",
) {
  const ids = await passageirosDaSaida(rotaId, dataViagem);
  if (!ids.length) return 0;
  await supabaseAdmin
    .from("notificacoes")
    .insert(ids.map((user_id) => ({ user_id, titulo, mensagem, tipo })));
  return ids.length;
}

/* ------------------------------------------------------------- coberturas */

/** Cobertura mensal vigente do motorista, ou null. */
export async function coberturaMensalVigente(userId: string, env: StripeEnv) {
  const { data } = await supabaseAdmin
    .from("coberturas_seguro")
    .select("*")
    .eq("user_id", userId)
    .eq("modalidade", "mensal")
    .eq("status", "ativa")
    .eq("environment", env)
    .gt("vigencia_fim", new Date().toISOString())
    .order("vigencia_fim", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Cobertura que autoriza o chamado da saída: mensal do motorista ou avulsa da saída. */
export async function coberturaDaSaida(params: {
  rotaId: string;
  dataViagem: string;
  motoristaId: string;
  env: StripeEnv;
}) {
  const mensal = await coberturaMensalVigente(params.motoristaId, params.env);
  if (mensal) return mensal;
  const { data } = await supabaseAdmin
    .from("coberturas_seguro")
    .select("*")
    .eq("modalidade", "avulsa")
    .eq("rota_id", params.rotaId)
    .eq("data_viagem", params.dataViagem)
    .eq("status", "ativa")
    .eq("environment", params.env)
    .gt("vigencia_fim", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function vigencia(modalidade: ModalidadeCobertura, dataViagem?: string | null) {
  const inicio = new Date();
  if (modalidade === "mensal") {
    const fim = new Date(inicio.getTime() + DIAS_COBERTURA_MENSAL * 86400_000);
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }
  // Avulsa: cobre o dia da viagem inteiro (até o fim do dia seguinte, para
  // viagens que atravessam a madrugada).
  const base = dataViagem ? new Date(`${dataViagem}T23:59:59Z`) : new Date(inicio.getTime() + 86400_000);
  const fim = new Date(base.getTime() + 86400_000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

async function gravarCobertura(params: {
  userId: string;
  modalidade: ModalidadeCobertura;
  priceId: string;
  valor: number;
  assentos: number;
  rotaId?: string | null;
  dataViagem?: string | null;
  env: StripeEnv;
  origem: string;
  referencia?: string | null;
}) {
  const { inicio, fim } = vigencia(params.modalidade, params.dataViagem ?? null);
  const { data, error } = await supabaseAdmin
    .from("coberturas_seguro")
    .insert({
      user_id: params.userId,
      modalidade: params.modalidade,
      price_id: params.priceId,
      valor: params.valor,
      assentos: params.assentos,
      rota_id: params.rotaId ?? null,
      data_viagem: params.dataViagem ?? null,
      status: "ativa",
      vigencia_inicio: inicio,
      vigencia_fim: fim,
      environment: params.env,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("lancamentos_contabeis").insert({
    tipo: params.origem === "creditos" ? "taxa_plataforma" : "receita_bruta",
    valor: params.valor,
    descricao: `Proteção RotaCerta (${params.modalidade})`,
    competencia: competencia(),
    detalhamento: {
      origem: `protecao_${params.origem}`,
      cobertura_id: data.id,
      referencia: params.referencia ?? null,
      ambiente: params.env,
    },
  });

  await registrarEvento({
    evento: "protecao_contratada",
    registradoPor: params.userId,
    dados: {
      cobertura_id: data.id,
      modalidade: params.modalidade,
      valor: params.valor,
      assentos: params.assentos,
      rota_id: params.rotaId ?? null,
      data_viagem: params.dataViagem ?? null,
      origem: params.origem,
      ambiente: params.env,
    },
  });

  await notificar(
    params.userId,
    "Proteção ativada",
    params.modalidade === "mensal"
      ? `Sua Proteção RotaCerta está ativa até ${new Date(fim).toLocaleDateString("pt-BR")}.`
      : `Proteção da viagem de ${params.dataViagem} confirmada para ${params.assentos} assento(s).`,
    "sucesso",
  );

  return data;
}

/* ------------------------------------------------- contratação com créditos */

async function saldoCarteira(userId: string, env: StripeEnv): Promise<number> {
  const { data } = await supabaseAdmin.rpc("saldo_carteira", { _user_id: userId, _env: env });
  return arred(Number(data ?? 0));
}

/** Contrata a proteção debitando créditos da carteira (compra feita via Pix). */
export async function contratarProtecaoComCreditos(params: {
  userId: string;
  modalidade: ModalidadeCobertura;
  rotaId?: string | null;
  dataViagem?: string | null;
  assentos?: number;
  env: StripeEnv;
}) {
  const assentos = params.modalidade === "avulsa" ? Math.max(1, params.assentos ?? 1) : 1;
  const valor =
    params.modalidade === "mensal" ? VALOR_PROTECAO_MENSAL : valorProtecaoAvulsa(assentos);

  if (params.modalidade === "mensal") {
    const atual = await coberturaMensalVigente(params.userId, params.env);
    if (atual) throw new Error("Você já tem proteção mensal ativa.");
  }
  if (params.modalidade === "avulsa" && (!params.rotaId || !params.dataViagem)) {
    throw new Error("Informe a rota e a data da viagem para a proteção avulsa.");
  }

  const saldo = await saldoCarteira(params.userId, params.env);
  if (saldo < valor) {
    throw new Error(
      `Saldo insuficiente: a proteção custa ${reais(valor)} e você tem ${reais(saldo)} em créditos.`,
    );
  }

  const { error } = await supabaseAdmin.from("carteira_transacoes").insert({
    user_id: params.userId,
    tipo: "debito_assinatura",
    valor,
    descricao: `Proteção RotaCerta (${params.modalidade})`,
    referencia_externa: `protecao:${params.modalidade}:${params.rotaId ?? "mensal"}:${params.dataViagem ?? new Date().toISOString().slice(0, 10)}`,
    environment: params.env,
  });
  if (error) throw new Error(error.message);

  const cobertura = await gravarCobertura({
    userId: params.userId,
    modalidade: params.modalidade,
    priceId: params.modalidade === "mensal" ? PRICE_PROTECAO_MENSAL : PRICE_PROTECAO_AVULSA,
    valor,
    assentos,
    rotaId: params.rotaId ?? null,
    dataViagem: params.dataViagem ?? null,
    env: params.env,
    origem: "creditos",
  });

  return { cobertura, valor, saldoRestante: arred(saldo - valor) };
}

/* -------------------------------------------------------- checkout no cartão */

async function resolverCliente(
  stripe: Stripe,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Identificador de usuário inválido.");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const cliente = existing.data[0];
    if (cliente) return cliente.id;
  }
  const criado = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return criado.id;
}

/** Checkout embutido da proteção (Pix e cartões de todas as bandeiras). */
export async function criarCheckoutProtecao(dados: {
  userId: string;
  email?: string | undefined;
  modalidade: ModalidadeCobertura;
  rotaId?: string | null;
  dataViagem?: string | null;
  assentos?: number;
  returnUrl: string;
  environment: StripeEnv;
}) {
  const assentos = dados.modalidade === "avulsa" ? Math.max(1, dados.assentos ?? 1) : 1;
  const valor =
    dados.modalidade === "mensal" ? VALOR_PROTECAO_MENSAL : valorProtecaoAvulsa(assentos);

  if (dados.modalidade === "mensal") {
    const atual = await coberturaMensalVigente(dados.userId, dados.environment);
    if (atual) throw new Error("Você já tem proteção mensal ativa.");
  }
  if (dados.modalidade === "avulsa" && (!dados.rotaId || !dados.dataViagem)) {
    throw new Error("Informe a rota e a data da viagem para a proteção avulsa.");
  }

  const stripe = createStripeClient(dados.environment);
  const customer = await resolverCliente(stripe, { email: dados.email, userId: dados.userId });
  const nome =
    dados.modalidade === "mensal"
      ? "Proteção RotaCerta — 30 dias"
      : `Proteção da viagem — ${assentos} assento(s)`;

  const payload: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    ui_mode: "embedded_page",
    return_url: dados.returnUrl,
    customer,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: Math.round(valor * 100),
          product_data: {
            name: nome,
            description:
              "Veículo substituto para os passageiros e remoção do veículo até a oficina indicada.",
          },
        },
      },
    ],
    metadata: {
      tipo: "protecao",
      userId: dados.userId,
      modalidade: dados.modalidade,
      assentos: String(assentos),
      priceId: dados.modalidade === "mensal" ? PRICE_PROTECAO_MENSAL : PRICE_PROTECAO_AVULSA,
      ...(dados.rotaId && { rotaId: dados.rotaId }),
      ...(dados.dataViagem && { dataViagem: dados.dataViagem }),
    },
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      ...payload,
      payment_method_types: ["card", "pix"],
    });
  } catch {
    session = await stripe.checkout.sessions.create({ ...payload, payment_method_types: ["card"] });
  }

  return { clientSecret: session.client_secret ?? "", valor };
}

/** Fulfilment da sessão de proteção confirmada pelo provedor. */
export async function confirmarProtecao(session: any, env: StripeEnv) {
  const meta = session?.metadata ?? {};
  const userId = meta.userId as string | undefined;
  const modalidade = meta.modalidade as ModalidadeCobertura | undefined;
  if (!userId || (modalidade !== "mensal" && modalidade !== "avulsa")) {
    console.error("Sessão de proteção sem metadados válidos:", session?.id);
    return;
  }

  const { data: existente } = await supabaseAdmin
    .from("coberturas_seguro")
    .select("id")
    .eq("user_id", userId)
    .eq("environment", env)
    .eq("price_id", modalidade === "mensal" ? PRICE_PROTECAO_MENSAL : PRICE_PROTECAO_AVULSA)
    .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (existente) return; // idempotência simples contra reentrega do webhook

  const assentos = Math.max(1, Number(meta.assentos ?? 1) || 1);
  const valor =
    modalidade === "mensal" ? VALOR_PROTECAO_MENSAL : arred(assentos * VALOR_PROTECAO_ASSENTO);

  await gravarCobertura({
    userId,
    modalidade,
    priceId: modalidade === "mensal" ? PRICE_PROTECAO_MENSAL : PRICE_PROTECAO_AVULSA,
    valor,
    assentos,
    rotaId: (meta.rotaId as string | undefined) ?? null,
    dataViagem: (meta.dataViagem as string | undefined) ?? null,
    env,
    origem: "provedor",
    referencia: session?.id ?? null,
  });
}

/* ------------------------------------------------------------- sinistros */

async function carregarViagem(viagemId: string) {
  const { data, error } = await supabaseAdmin
    .from("viagens")
    .select("*, rotas(origem, destino)")
    .eq("id", viagemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Viagem não encontrada.");
  return data;
}

/** Abre o chamado de pane, interrompe a viagem e avisa todos os envolvidos. */
export async function abrirSinistro(params: {
  viagemId: string;
  motoristaId: string;
  tipoPane: string;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  env: StripeEnv;
}) {
  const viagem = await carregarViagem(params.viagemId);
  if (viagem.motorista_id !== params.motoristaId) {
    throw new Error("Somente o motorista da viagem pode abrir o chamado.");
  }

  const cobertura = await coberturaDaSaida({
    rotaId: viagem.rota_id,
    dataViagem: viagem.data_viagem,
    motoristaId: viagem.motorista_id,
    env: params.env,
  });
  if (!cobertura) {
    throw new Error(
      "Nenhuma proteção ativa para esta saída. Contrate a Proteção RotaCerta para abrir o chamado.",
    );
  }

  const { data: aberto } = await supabaseAdmin
    .from("sinistros")
    .select("id")
    .eq("viagem_id", params.viagemId)
    .not("status", "in", '("concluido","cancelado")')
    .limit(1)
    .maybeSingle();
  if (aberto) throw new Error("Já existe um chamado em andamento para esta viagem.");

  const passageiros = await passageirosDaSaida(viagem.rota_id, viagem.data_viagem);
  const { data: oficina } = await supabaseAdmin
    .from("oficinas")
    .select("id, nome, endereco")
    .eq("user_id", viagem.motorista_id)
    .order("preferida", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: sinistro, error } = await supabaseAdmin
    .from("sinistros")
    .insert({
      viagem_id: params.viagemId,
      veiculo_id: viagem.veiculo_id,
      motorista_id: viagem.motorista_id,
      cobertura_id: cobertura.id,
      oficina_id: oficina?.id ?? null,
      tipo_pane: params.tipoPane,
      descricao: params.descricao ?? null,
      latitude: params.latitude ?? viagem.ultima_latitude,
      longitude: params.longitude ?? viagem.ultima_longitude,
      passageiros_afetados: passageiros.length,
      status: "aberto",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("viagens")
    .update({ status: "interrompida" })
    .eq("id", params.viagemId);

  await notificar(
    viagem.motorista_id,
    "Chamado de pane aberto",
    oficina
      ? `Assistência acionada. O veículo será removido para ${oficina.nome}.`
      : "Assistência acionada. Cadastre uma oficina de confiança para agilizar a remoção.",
    "alerta",
  );
  await notificarSaida(
    viagem.rota_id,
    viagem.data_viagem,
    "Pane na sua viagem",
    "O veículo apresentou uma pane e a assistência já foi acionada. Um veículo substituto será despachado — acompanhe pelo app.",
    "alerta",
  );

  await registrarEvento({
    evento: "sinistro_aberto",
    registradoPor: viagem.motorista_id,
    dados: {
      sinistro_id: sinistro.id,
      viagem_id: params.viagemId,
      rota_id: viagem.rota_id,
      data_viagem: viagem.data_viagem,
      tipo_pane: params.tipoPane,
      cobertura_id: cobertura.id,
      passageiros_afetados: passageiros.length,
      oficina: oficina?.nome ?? null,
      ambiente: params.env,
    },
  });

  return sinistro;
}

async function atualizarSinistro(
  sinistroId: string,
  destino: StatusSinistro,
  patch: Record<string, unknown>,
  quem: string,
) {
  const { data: atual, error } = await supabaseAdmin
    .from("sinistros")
    .select("*, viagens(rota_id, data_viagem, motorista_id)")
    .eq("id", sinistroId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!atual) throw new Error("Chamado não encontrado.");
  if (!podeTransicionar(atual.status as StatusSinistro, destino)) {
    throw new Error(`Não é possível ir de "${atual.status}" para "${destino}".`);
  }

  const { data: novo, error: erroUpdate } = await supabaseAdmin
    .from("sinistros")
    .update({ status: destino, ...patch })
    .eq("id", sinistroId)
    .select("*")
    .single();
  if (erroUpdate) throw new Error(erroUpdate.message);

  await registrarEvento({
    evento: "sinistro_atualizado",
    registradoPor: quem,
    dados: { sinistro_id: sinistroId, de: atual.status, para: destino, ...patch },
  });

  return { atual, novo };
}

/** Despacha o veículo substituto que dará continuidade à viagem. */
export async function despacharSubstituto(params: {
  sinistroId: string;
  motorista: string;
  placa: string;
  etaMinutos: number;
  quem: string;
}) {
  const eta = new Date(Date.now() + Math.max(1, params.etaMinutos) * 60_000).toISOString();
  const { atual, novo } = await atualizarSinistro(
    params.sinistroId,
    "substituto_despachado",
    {
      substituto_motorista: params.motorista,
      substituto_placa: params.placa,
      substituto_eta: eta,
      despachado_em: new Date().toISOString(),
    },
    params.quem,
  );

  const viagem = (atual as any).viagens;
  await notificar(
    atual.motorista_id,
    "Veículo substituto a caminho",
    `${params.motorista} (${params.placa}) chega em cerca de ${params.etaMinutos} min.`,
    "sucesso",
  );
  if (viagem) {
    await notificarSaida(
      viagem.rota_id,
      viagem.data_viagem,
      "Veículo substituto a caminho",
      `Um veículo substituto (${params.placa}) chega em cerca de ${params.etaMinutos} min para continuar a viagem.`,
      "sucesso",
    );
  }
  return novo;
}

/** Confirma que os passageiros seguiram viagem no veículo substituto. */
export async function realocarPassageiros(params: { sinistroId: string; quem: string }) {
  const { atual, novo } = await atualizarSinistro(
    params.sinistroId,
    "passageiros_realocados",
    {},
    params.quem,
  );
  const viagem = (atual as any).viagens;
  if (novo.substituto_placa && viagem) {
    await supabaseAdmin
      .from("viagens")
      .update({ status: "em_viagem", veiculo_substituto_placa: novo.substituto_placa })
      .eq("id", atual.viagem_id);
  }
  if (viagem) {
    await notificarSaida(
      viagem.rota_id,
      viagem.data_viagem,
      "Viagem retomada",
      "Os passageiros seguem viagem no veículo substituto. O acompanhamento ao vivo continua no app.",
      "sucesso",
    );
  }
  return novo;
}

/** Registra a remoção do veículo avariado até a oficina indicada. */
export async function acionarReboque(params: {
  sinistroId: string;
  oficinaId?: string | null;
  quem: string;
}) {
  const { atual, novo } = await atualizarSinistro(
    params.sinistroId,
    "reboque_acionado",
    {
      reboque_em: new Date().toISOString(),
      ...(params.oficinaId ? { oficina_id: params.oficinaId } : {}),
    },
    params.quem,
  );
  await notificar(
    atual.motorista_id,
    "Reboque acionado",
    "O reboque foi acionado para levar o veículo até a oficina indicada.",
    "info",
  );
  return novo;
}

/** Veículo entregue na oficina. */
export async function veiculoNaOficina(params: { sinistroId: string; quem: string }) {
  const { atual, novo } = await atualizarSinistro(
    params.sinistroId,
    "veiculo_na_oficina",
    {},
    params.quem,
  );
  await notificar(
    atual.motorista_id,
    "Veículo na oficina",
    "Seu veículo foi entregue na oficina indicada. Registre a indisponibilidade até a conclusão do reparo.",
    "info",
  );
  return novo;
}

/** Encerra o atendimento e lança o custo do acionamento na contabilidade. */
export async function concluirSinistro(params: {
  sinistroId: string;
  custo?: number | null;
  quem: string;
}) {
  const { atual, novo } = await atualizarSinistro(
    params.sinistroId,
    "concluido",
    { concluido_em: new Date().toISOString() },
    params.quem,
  );

  if (params.custo && params.custo > 0) {
    await supabaseAdmin.from("custos_terceiros").insert({
      fornecedor: "Assistência 24h",
      categoria: "seguro",
      descricao: `Acionamento de pane — chamado ${params.sinistroId.slice(0, 8)}`,
      valor: arred(params.custo),
      competencia: competencia(),
      recorrente: false,
    });
    await supabaseAdmin.from("lancamentos_contabeis").insert({
      tipo: "custo_terceiro",
      valor: arred(params.custo),
      descricao: "Acionamento de assistência (pane)",
      competencia: competencia(),
      detalhamento: { origem: "sinistro", sinistro_id: params.sinistroId },
    });
  }

  await notificar(
    atual.motorista_id,
    "Atendimento concluído",
    "O chamado de pane foi encerrado. Obrigado por manter a viagem segura.",
    "sucesso",
  );
  return novo;
}

/** Cancela o chamado (aberto por engano). */
export async function cancelarSinistro(params: { sinistroId: string; quem: string }) {
  const { atual, novo } = await atualizarSinistro(params.sinistroId, "cancelado", {}, params.quem);
  await supabaseAdmin
    .from("viagens")
    .update({ status: "em_viagem" })
    .eq("id", atual.viagem_id)
    .eq("status", "interrompida");
  return novo;
}

/**
 * Renovação diária das coberturas mensais por débito de créditos, e
 * encerramento das que venceram sem saldo. Chamada pela rotina agendada.
 */
export async function renovarCoberturas(env: StripeEnv) {
  const agora = new Date().toISOString();
  const { data: vencidas } = await supabaseAdmin
    .from("coberturas_seguro")
    .select("*")
    .eq("modalidade", "mensal")
    .eq("status", "ativa")
    .eq("environment", env)
    .lte("vigencia_fim", agora);

  let renovadas = 0;
  let encerradas = 0;
  for (const cob of vencidas ?? []) {
    await supabaseAdmin.from("coberturas_seguro").update({ status: "encerrada" }).eq("id", cob.id);
    try {
      await contratarProtecaoComCreditos({
        userId: cob.user_id,
        modalidade: "mensal",
        env,
      });
      renovadas += 1;
    } catch {
      encerradas += 1;
      await notificar(
        cob.user_id,
        "Proteção encerrada",
        "Não foi possível renovar sua Proteção RotaCerta por falta de créditos. Compre créditos por Pix ou contrate no cartão para voltar a ficar coberto.",
        "alerta",
      );
    }
  }
  return { renovadas, encerradas };
}
