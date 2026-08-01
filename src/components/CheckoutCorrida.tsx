import { useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { X } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { criarCobrancaCorrida } from "@/utils/cobranca.functions";

export function CheckoutCorrida({
  corridaId,
  valorBase,
  onFechar,
}: {
  corridaId: string;
  valorBase?: number;
  onFechar: () => void;
}) {
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        const resultado = await criarCobrancaCorrida({
          data: {
            corridaId,
            returnUrl: `${window.location.origin}/checkout-retorno?session_id={CHECKOUT_SESSION_ID}`,
            environment: getStripeEnvironment(),
            ...(valorBase ? { valorBase } : {}),
          },
        });
        if ("error" in resultado) throw new Error(resultado.error);
        if (!resultado.clientSecret) throw new Error("O provedor não retornou a sessão de pagamento.");
        return resultado.clientSecret;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Cobrança online</h2>
            <p className="text-sm text-muted-foreground">
              Pix e cartões de crédito e débito de todas as bandeiras habilitadas.
            </p>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto rounded-full border border-border p-2"
            aria-label="Fechar cobrança"
          >
            <X className="size-4" />
          </button>
        </div>
        <div id="checkout" className="mt-5">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
