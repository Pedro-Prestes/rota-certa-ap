import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface EntradaReservaCliente {
  rotaId: string;
  dataViagem: string;
  assentos: number;
  assentosBagagem?: number;
  enderecoEmbarque?: string;
  environment?: "sandbox" | "live";
  exclusiva?: boolean;
  bagagemKg?: number;
}

const validar = (data: EntradaReservaCliente) => {
  if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Saída inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dataViagem)) throw new Error("Data da viagem inválida.");
  if (!Number.isInteger(data.assentos) || data.assentos < 1 || data.assentos > 8) {
    throw new Error("Informe de 1 a 8 assentos.");
  }
  const bagagem = Math.trunc(data.assentosBagagem ?? 0);
  if (bagagem < 0 || bagagem > 8) throw new Error("Bagagem excedente inválida.");
  const endereco = data.enderecoEmbarque?.trim() ?? "";
  if (endereco.length > 240) throw new Error("Endereço de embarque muito longo.");
  const bagagemKg = Number(data.bagagemKg ?? 0);
  if (!Number.isFinite(bagagemKg) || bagagemKg < 0 || bagagemKg > 1000) {
    throw new Error("Peso da bagagem inválido.");
  }
  return {
    ...data,
    assentosBagagem: bagagem,
    exclusiva: data.exclusiva === true,
    bagagemKg,
    ...(endereco ? { enderecoEmbarque: endereco } : {}),
  };
};



/** Valor da reserva, saldo de créditos e quanto falta para garantir o assento. */
export const previaDaReserva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    const { previaReserva } = await import("@/lib/reserva.server");
    try {
      return await previaReserva({
        userId: context.userId,
        rotaId: data.rotaId,
        dataViagem: data.dataViagem,
        assentos: data.assentos,
        assentosBagagem: data.assentosBagagem,
        enderecoEmbarque: data.enderecoEmbarque,
        environment: data.environment ?? "live",

      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível calcular a reserva." };
    }
  });

/** Gera um Pix avulso pelo valor exato da corrida (sem exigir saldo). */
export const gerarPixDaCorrida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EntradaReservaCliente & { cpf?: string }) => {
    if (data.cpf && data.cpf.replace(/\D/g, "").length !== 11) throw new Error("CPF inválido.");
    return { ...validar(data), ...(data.cpf ? { cpf: data.cpf } : {}) };
  })
  .handler(async ({ data, context }) => {
    const { criarPixDaCorrida } = await import("@/lib/reserva.server");
    try {
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

      return await criarPixDaCorrida({
        userId: context.userId,
        rotaId: data.rotaId,
        dataViagem: data.dataViagem,
        assentos: data.assentos,
        assentosBagagem: data.assentosBagagem,
        enderecoEmbarque: data.enderecoEmbarque,
        environment: data.environment ?? "live",

        email,
        nome: perfil?.nome_completo ?? undefined,
        cpf: (data as { cpf?: string }).cpf,
        notificationUrl:
          process.env["MERCADOPAGO_NOTIFICATION_URL"] ??
          "https://rota-certa-ap.lovable.app/api/public/webhooks/mercadopago",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível gerar o Pix." };
    }
  });

/** Paga a reserva com os créditos da carteira e garante a lotação. */

export const pagarReservaComCreditos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    const { reservarComCreditos } = await import("@/lib/reserva.server");
    try {
      return await reservarComCreditos({
        userId: context.userId,
        rotaId: data.rotaId,
        dataViagem: data.dataViagem,
        assentos: data.assentos,
        assentosBagagem: data.assentosBagagem,
        enderecoEmbarque: data.enderecoEmbarque,
        environment: data.environment ?? "live",

      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível concluir a reserva." };
    }
  });
