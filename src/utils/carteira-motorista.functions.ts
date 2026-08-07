import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EntradaConta } from "@/lib/carteira-motorista";

const uuid = /^[0-9a-fA-F-]{36}$/;

const PERFIS_GESTAO_REPASSE = ["admin", "admin_secundario", "gerente"];

/** Papéis do usuário autenticado (leitura permitida pela política própria). */
async function ehGestao(
  supabase: { from: (t: "user_roles") => any },
  userId: string,
): Promise<boolean> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).some((r) => PERFIS_GESTAO_REPASSE.includes(r.role));
}


/** Saldos, movimentações, contas de repasse e histórico de saques do motorista. */
export const consultarCarteiraMotorista = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { painelCarteira } = await import("@/lib/carteira-motorista.server");
    return painelCarteira(context.userId);
  });

/** Cadastra ou atualiza uma conta bancária / chave Pix de repasse. */
export const salvarContaRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contaId?: string; principal?: boolean; dados: EntradaConta }) => {
    if (data.contaId && !uuid.test(data.contaId)) throw new Error("Conta inválida.");
    if (!data.dados) throw new Error("Informe os dados da conta.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { salvarContaRepasse: salvar } = await import("@/lib/carteira-motorista.server");
      return await salvar({
        driverId: context.userId,
        contaId: data.contaId,
        dados: data.dados,
        principal: !!data.principal,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const definirContaPrincipal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contaId: string }) => {
    if (!uuid.test(data.contaId ?? "")) throw new Error("Conta inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { definirContaPrincipal: definir } = await import("@/lib/carteira-motorista.server");
      return await definir(context.userId, data.contaId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

export const removerContaRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contaId: string }) => {
    if (!uuid.test(data.contaId ?? "")) throw new Error("Conta inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { removerContaRepasse: remover } = await import("@/lib/carteira-motorista.server");
      return await remover(context.userId, data.contaId);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Saque instantâneo (Pix) ou TED sob demanda. */
export const solicitarSaqueMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { valor: number; metodo: "PIX" | "TED"; contaId?: string }) => {
    if (!(Number(data.valor) > 0)) throw new Error("Informe o valor do saque.");
    if (data.metodo !== "PIX" && data.metodo !== "TED") throw new Error("Método de saque inválido.");
    if (data.contaId && !uuid.test(data.contaId)) throw new Error("Conta inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { solicitarSaque } = await import("@/lib/carteira-motorista.server");
      const r = await solicitarSaque({
        driverId: context.userId,
        valor: Number(data.valor),
        metodo: data.metodo,
        contaId: data.contaId,
        modo: "INSTANT",
      });
      return { repasse: r.repasse, valor: r.valor, taxa: r.taxa, liquido: r.liquido };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

/** Gestão: repasses aguardando liquidação bancária. */
export const listarRepassesPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const meus = await papeis(context.supabase as never, context.userId);
    if (!meus.some((p) => ["admin", "admin_secundario", "gerente"].includes(p))) {
      return { error: "Apenas a gestão pode acompanhar os repasses." };
    }
    const { repassesPendentes } = await import("@/lib/carteira-motorista.server");
    return repassesPendentes();
  });

/** Gestão: confirma ou marca como falha a liquidação de um repasse. */
export const concluirRepasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { payoutId: string; status: "PAID" | "FAILED"; referencia?: string; motivo?: string }) => {
    if (!uuid.test(data.payoutId ?? "")) throw new Error("Repasse inválido.");
    if (data.status !== "PAID" && data.status !== "FAILED") throw new Error("Situação inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const meus = await papeis(context.supabase as never, context.userId);
    if (!meus.some((p) => ["admin", "admin_secundario", "gerente"].includes(p))) {
      return { error: "Apenas a gestão pode liquidar repasses." };
    }
    try {
      const { atualizarRepasse } = await import("@/lib/carteira-motorista.server");
      return await atualizarRepasse({
        payoutId: data.payoutId,
        status: data.status,
        referencia: data.referencia,
        motivo: data.motivo,
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
