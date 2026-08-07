import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  comporValorPix,
  criarPagamentoPix,
  itemDoPrice,
  sincronizarPagamentoPix,
} from "@/lib/mercadopago.server";
import { ehPriceValido } from "@/lib/planos";

const URL_WEBHOOK_PADRAO = "https://rota-certa-ap.lovable.app/api/public/webhooks/mercadopago";

/** Prévia do valor (base + taxa administrativa) exibida antes de gerar o Pix. */
export const previaValorPix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Plano ou pacote inválido.");
    return data;
  })
  .handler(async ({ data }) => {
    const item = itemDoPrice(data.priceId);
    const composicao = comporValorPix(item.base);
    return { ...composicao, creditos: item.creditos, descricao: item.descricao };
  });

/** Cria o pagamento Pix no Mercado Pago e devolve o QR Code para o usuário. */
export const gerarPixMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; cpf?: string; environment?: "sandbox" | "live" }) => {
    if (!ehPriceValido(data.priceId)) throw new Error("Plano ou pacote inválido.");
    if (data.cpf && data.cpf.replace(/\D/g, "").length !== 11) throw new Error("CPF inválido.");
    return data;
  })
  .handler(async ({ data, context }) => {
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

      const pix = await criarPagamentoPix({
        userId: context.userId,
        priceId: data.priceId,
        email,
        ...(perfil?.nome_completo ? { nome: perfil.nome_completo } : {}),
        ...(data.cpf ? { cpf: data.cpf } : {}),
        environment: data.environment ?? "live",
        notificationUrl: process.env["MERCADOPAGO_NOTIFICATION_URL"] ?? URL_WEBHOOK_PADRAO,
      });
      return pix;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível gerar o Pix." };
    }
  });

/** Consulta o status do Pix (fallback caso o webhook atrase). */
export const consultarPixMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pagamentoId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.pagamentoId)) throw new Error("Pagamento inválido.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: registro } = await context.supabase
      .from("pagamentos_pix")
      .select("id, provedor_payment_id, status, creditado_em")
      .eq("id", data.pagamentoId)
      .maybeSingle();
    if (!registro) return { error: "Pagamento não encontrado." };
    if (!registro.provedor_payment_id) return { status: registro.status, creditado: false };
    try {
      const r = await sincronizarPagamentoPix(registro.provedor_payment_id);
      return r;
    } catch {
      return { status: registro.status, creditado: Boolean(registro.creditado_em) };
    }
  });
