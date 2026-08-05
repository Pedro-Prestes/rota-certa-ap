import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { TIPOS_PANE } from "@/lib/seguro";

const uuid = /^[0-9a-fA-F-]{36}$/;
const dataISO = /^\d{4}-\d{2}-\d{2}$/;

function validarEnv(env: string): StripeEnv {
  if (env !== "sandbox" && env !== "live") throw new Error("Ambiente inválido.");
  return env;
}

function validarModalidade(m: string): "mensal" | "avulsa" {
  if (m !== "mensal" && m !== "avulsa") throw new Error("Modalidade inválida.");
  return m;
}

interface EntradaProtecao {
  modalidade: string;
  environment: string;
  rotaId?: string;
  dataViagem?: string;
  assentos?: number;
}

function validarProtecao(data: EntradaProtecao) {
  const modalidade = validarModalidade(data.modalidade ?? "");
  const environment = validarEnv(data.environment ?? "");
  if (modalidade === "avulsa") {
    if (!uuid.test(data.rotaId ?? "")) throw new Error("Rota inválida.");
    if (!dataISO.test(data.dataViagem ?? "")) throw new Error("Data inválida.");
  }
  const assentos = Math.max(1, Math.min(20, Math.trunc(data.assentos ?? 1) || 1));
  return {
    modalidade,
    environment,
    assentos,
    rotaId: data.rotaId ?? null,
    dataViagem: data.dataViagem ?? null,
  };
}

/** Contrata a proteção debitando créditos da carteira (comprados via Pix). */
export const contratarProtecaoCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validarProtecao)
  .handler(async ({ data, context }) => {
    try {
      const { contratarProtecaoComCreditos } = await import("@/lib/seguro.server");
      const r = await contratarProtecaoComCreditos({
        userId: context.userId,
        modalidade: data.modalidade,
        rotaId: data.rotaId,
        dataViagem: data.dataViagem,
        assentos: data.assentos,
        env: data.environment,
      });
      return { ok: true as const, valor: r.valor, saldoRestante: r.saldoRestante };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Checkout embutido da proteção (Pix e cartões). */
export const criarCheckoutProtecaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaProtecao & { returnUrl: string }) => {
    if (!/^https?:\/\//.test(data.returnUrl ?? "")) throw new Error("URL de retorno inválida.");
    return { ...validarProtecao(data), returnUrl: data.returnUrl };
  })
  .handler(async ({ data, context }) => {
    try {
      const { criarCheckoutProtecao } = await import("@/lib/seguro.server");
      const {
        data: { user },
      } = await context.supabase.auth.getUser();
      return await criarCheckoutProtecao({
        userId: context.userId,
        email: user?.email ?? undefined,
        modalidade: data.modalidade,
        rotaId: data.rotaId,
        dataViagem: data.dataViagem,
        assentos: data.assentos,
        returnUrl: data.returnUrl,
        environment: data.environment,
      });
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Situação da cobertura de uma saída (para liberar o botão de pane). */
export const consultarCobertura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string; dataViagem: string; environment: string }) => {
    if (!uuid.test(data.rotaId ?? "")) throw new Error("Rota inválida.");
    if (!dataISO.test(data.dataViagem ?? "")) throw new Error("Data inválida.");
    return { ...data, environment: validarEnv(data.environment) };
  })
  .handler(async ({ data, context }) => {
    try {
      const { coberturaDaSaida, coberturaMensalVigente } = await import("@/lib/seguro.server");
      const [saida, mensal] = await Promise.all([
        coberturaDaSaida({
          rotaId: data.rotaId,
          dataViagem: data.dataViagem,
          motoristaId: context.userId,
          env: data.environment,
        }),
        coberturaMensalVigente(context.userId, data.environment),
      ]);
      return {
        protegida: Boolean(saida),
        modalidade: saida?.modalidade ?? null,
        vigenciaFim: saida?.vigencia_fim ?? null,
        mensalAtiva: Boolean(mensal),
        mensalFim: mensal?.vigencia_fim ?? null,
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Abre o chamado de pane da viagem em curso. */
export const reportarPane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      viagemId: string;
      tipoPane: string;
      descricao?: string;
      latitude?: number;
      longitude?: number;
      environment: string;
    }) => {
      if (!uuid.test(data.viagemId ?? "")) throw new Error("Viagem inválida.");
      if (!(TIPOS_PANE as readonly string[]).includes(data.tipoPane ?? "")) {
        throw new Error("Selecione o tipo de pane.");
      }
      if ((data.descricao?.length ?? 0) > 500) throw new Error("Descrição muito longa.");
      return { ...data, environment: validarEnv(data.environment) };
    },
  )
  .handler(async ({ data, context }) => {
    try {
      const { abrirSinistro } = await import("@/lib/seguro.server");
      const sinistro = await abrirSinistro({
        viagemId: data.viagemId,
        motoristaId: context.userId,
        tipoPane: data.tipoPane,
        descricao: data.descricao ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        env: data.environment,
      });
      return { sinistro };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

async function exigirAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Somente o administrador atende chamados.");
}

/** Atendimento do chamado (administrador / assistência). */
export const atenderSinistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sinistroId: string;
      acao: string;
      motorista?: string;
      placa?: string;
      etaMinutos?: number;
      oficinaId?: string;
      custo?: number;
    }) => {
      if (!uuid.test(data.sinistroId ?? "")) throw new Error("Chamado inválido.");
      const acoes = ["despachar", "realocar", "reboque", "na_oficina", "concluir", "cancelar"];
      if (!acoes.includes(data.acao ?? "")) throw new Error("Ação inválida.");
      if (data.acao === "despachar") {
        if ((data.motorista?.trim().length ?? 0) < 3) throw new Error("Informe o motorista substituto.");
        if ((data.placa?.trim().length ?? 0) < 5) throw new Error("Informe a placa do substituto.");
        if (!data.etaMinutos || data.etaMinutos < 1 || data.etaMinutos > 600) {
          throw new Error("Informe o tempo estimado de chegada em minutos.");
        }
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    try {
      await exigirAdmin(context.supabase, context.userId);
      const seguro = await import("@/lib/seguro.server");
      const quem = context.userId;
      switch (data.acao) {
        case "despachar":
          return {
            sinistro: await seguro.despacharSubstituto({
              sinistroId: data.sinistroId,
              motorista: data.motorista!.trim(),
              placa: data.placa!.trim().toUpperCase(),
              etaMinutos: data.etaMinutos!,
              quem,
            }),
          };
        case "realocar":
          return { sinistro: await seguro.realocarPassageiros({ sinistroId: data.sinistroId, quem }) };
        case "reboque":
          return {
            sinistro: await seguro.acionarReboque({
              sinistroId: data.sinistroId,
              oficinaId: data.oficinaId ?? null,
              quem,
            }),
          };
        case "na_oficina":
          return { sinistro: await seguro.veiculoNaOficina({ sinistroId: data.sinistroId, quem }) };
        case "concluir":
          return {
            sinistro: await seguro.concluirSinistro({
              sinistroId: data.sinistroId,
              custo: data.custo ?? null,
              quem,
            }),
          };
        default:
          return { sinistro: await seguro.cancelarSinistro({ sinistroId: data.sinistroId, quem }) };
      }
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
