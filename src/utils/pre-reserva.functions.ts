import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface EntradaPreReserva {
  rotaId: string;
  dataViagem: string;
  assentos: number;
  assentosBagagem?: number;
  endereco: string;
  referencia?: string;
  exclusiva?: boolean;
  bagagemKg?: number;
}

const validar = (data: EntradaPreReserva) => {
  if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Saída inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dataViagem)) throw new Error("Data da viagem inválida.");
  if (!Number.isInteger(data.assentos) || data.assentos < 1 || data.assentos > 8) {
    throw new Error("Informe de 1 a 8 assentos.");
  }
  const endereco = (data.endereco ?? "").trim();
  if (endereco.length < 6 || endereco.length > 240) {
    throw new Error("Informe o endereço de embarque com mais detalhes.");
  }
  const bagagem = Math.trunc(data.assentosBagagem ?? 0);
  if (bagagem < 0 || bagagem > 8) throw new Error("Bagagem excedente inválida.");
  const bagagemKg = Number(data.bagagemKg ?? 0);
  if (!Number.isFinite(bagagemKg) || bagagemKg < 0 || bagagemKg > 1000) {
    throw new Error("Peso da bagagem inválido.");
  }
  return {
    rotaId: data.rotaId,
    dataViagem: data.dataViagem,
    assentos: data.assentos,
    assentosBagagem: bagagem,
    endereco,
    referencia: (data.referencia ?? "").trim().slice(0, 240),
    exclusiva: data.exclusiva === true,
    bagagemKg,
  };
};

/** Cria (ou atualiza) a pré-reserva do passageiro na saída escolhida. */
export const criarPreReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    try {
      const { localizarEmbarque } = await import("@/lib/pre-reserva.server");
      const local = await localizarEmbarque(data.rotaId, data.endereco);

      const { error } = await context.supabase.from("pre_reservas").upsert(
        {
          rota_id: data.rotaId,
          data_viagem: data.dataViagem,
          passageiro_id: context.userId,
          assentos: data.assentos,
          assentos_bagagem: data.assentosBagagem,
          endereco: local.enderecoFormatado,
          referencia: data.referencia || null,
          latitude: local.latitude,
          longitude: local.longitude,
          exclusiva: data.exclusiva,
          bagagem_kg: data.bagagemKg,
          status: "pendente",
          valor_ofertado: null,
          valor_base: null,
          taxa_desvio: null,
          km_desvio: null,
          minutos_desvio: null,
          fator_ocupacao: null,
          oferta_enviada_em: null,
          oferta_expira_em: null,
        },
        { onConflict: "rota_id,data_viagem,passageiro_id" },
      );
      if (error) throw new Error(error.message);
      return { ok: true as const, endereco: local.enderecoFormatado };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível pré-reservar." };
    }
  });

/** Pré-reservas do passageiro com a situação da fila de confirmação. */
export const minhasPreReservas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pre_reservas")
      .select(
        "id, rota_id, data_viagem, assentos, assentos_bagagem, endereco, status, valor_ofertado, valor_base, taxa_desvio, fator_ocupacao, oferta_expira_em, rotas(origem, destino, uf_origem, uf_destino, saida_ida, preco_assento, assentos)",
      )
      .eq("passageiro_id", context.userId)
      .order("data_viagem", { ascending: true });
    if (error) return { error: error.message };
    return { itens: data ?? [] };
  });

const idValido = (data: { preReservaId: string; environment?: "sandbox" | "live" }) => {
  if (!/^[0-9a-fA-F-]{36}$/.test(data.preReservaId)) throw new Error("Pré-reserva inválida.");
  return { preReservaId: data.preReservaId, environment: data.environment ?? "live" };
};

/** Cancela a própria pré-reserva antes do fechamento. */
export const cancelarPreReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idValido)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pre_reservas")
      .update({ status: "cancelada" })
      .eq("id", data.preReservaId)
      .eq("passageiro_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true as const };
  });

/** Aceita a oferta do fechamento pagando com créditos da carteira. */
export const aceitarOfertaComCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idValido)
  .handler(async ({ data, context }) => {
    try {
      const { pagarOfertaComCreditos } = await import("@/lib/oferta.server");
      return await pagarOfertaComCreditos(data.preReservaId, context.userId, data.environment);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível confirmar o pagamento." };
    }
  });

/** Gera o Pix avulso pelo valor exato da oferta. */
export const gerarPixDaOfertaFechada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { preReservaId: string; environment?: "sandbox" | "live"; cpf?: string }) => {
    if (data.cpf && data.cpf.replace(/\D/g, "").length !== 11) throw new Error("CPF inválido.");
    return { ...idValido(data), ...(data.cpf ? { cpf: data.cpf } : {}) };
  })
  .handler(async ({ data, context }) => {
    try {
      const { gerarPixDaOferta } = await import("@/lib/oferta.server");
      const {
        data: { user },
      } = await context.supabase.auth.getUser();
      const email = user?.email;
      if (!email) return { error: "Sua conta precisa de um e-mail válido para pagar com Pix." };

      const { data: perfil } = await context.supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", context.userId)
        .maybeSingle();

      return await gerarPixDaOferta({
        preReservaId: data.preReservaId,
        userId: context.userId,
        email,
        nome: perfil?.nome_completo ?? undefined,
        ...(data.cpf ? { cpf: data.cpf } : {}),
        environment: data.environment,
        notificationUrl:
          process.env["MERCADOPAGO_NOTIFICATION_URL"] ??
          "https://rota-certa-ap.lovable.app/api/public/webhooks/mercadopago",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível gerar o Pix." };
    }
  });

/** Fila e fechamento das saídas do motorista/frotista. */
export const filaDaSaida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string; dataViagem: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Saída inválida.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dataViagem)) throw new Error("Data inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const [{ data: itens, error }, { data: fechamento }] = await Promise.all([
      context.supabase
        .from("pre_reservas")
        .select("id, assentos, assentos_bagagem, endereco, status, valor_ofertado, oferta_expira_em")
        .eq("rota_id", data.rotaId)
        .eq("data_viagem", data.dataViagem)
        .order("assentos", { ascending: false }),
      context.supabase
        .from("fechamentos_saida")
        .select("*")
        .eq("rota_id", data.rotaId)
        .eq("data_viagem", data.dataViagem)
        .maybeSingle(),
    ]);
    if (error) return { error: error.message };
    return { itens: itens ?? [], fechamento: fechamento ?? null };
  });
