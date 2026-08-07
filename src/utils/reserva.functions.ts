import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface EntradaReservaCliente {
  rotaId: string;
  dataViagem: string;
  assentos: number;
  assentosBagagem?: number;
  environment?: "sandbox" | "live";
}

const validar = (data: EntradaReservaCliente) => {
  if (!/^[0-9a-fA-F-]{36}$/.test(data.rotaId)) throw new Error("Saída inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dataViagem)) throw new Error("Data da viagem inválida.");
  if (!Number.isInteger(data.assentos) || data.assentos < 1 || data.assentos > 8) {
    throw new Error("Informe de 1 a 8 assentos.");
  }
  const bagagem = Math.trunc(data.assentosBagagem ?? 0);
  if (bagagem < 0 || bagagem > 8) throw new Error("Bagagem excedente inválida.");
  return { ...data, assentosBagagem: bagagem };
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
        environment: data.environment ?? "live",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível calcular a reserva." };
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
        environment: data.environment ?? "live",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível concluir a reserva." };
    }
  });
