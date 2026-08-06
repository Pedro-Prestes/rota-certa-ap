import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

/**
 * Movimentação real: quando existe a chave pública de produção, ela é usada em
 * qualquer build (inclusive na pré-visualização), desativando o ambiente de teste.
 */
const liveToken = import.meta.env["VITE_PAYMENTS_LIVE_CLIENT_TOKEN"] as string | undefined;
const testeToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

const clientToken = liveToken?.startsWith("pk_live_") ? liveToken : testeToken;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_live_")) return "live";
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  throw new Error(
    "A cobrança online ainda não está configurada nesta versão do aplicativo. " +
      "Conclua a ativação de pagamentos do projeto para habilitar o checkout.",
  );
}


let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function cobrancaOnlineDisponivel(): boolean {
  return !!clientToken && (clientToken.startsWith("pk_test_") || clientToken.startsWith("pk_live_"));
}

/** True apenas quando a cobrança está apontada para o ambiente de teste. */
export function cobrancaOnlineEmTeste(): boolean {
  return !!clientToken?.startsWith("pk_test_");
}

