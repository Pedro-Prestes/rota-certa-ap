import { useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { X } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { criarCheckoutProtecaoFn } from "@/utils/seguro.functions";

/** Checkout embutido da Proteção RotaCerta (Pix e cartões de todas as bandeiras). */
export function CheckoutProtecao({
  modalidade,
  rotaId,
  dataViagem,
  assentos = 1,
  onFechar,
}: {
  modalidade: "mensal" | "avulsa";
  rotaId?: string;
  dataViagem?: string;
  assentos?: number;
  onFechar: () => void;
}) {
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => {
        const r = await criarCheckoutProtecaoFn({
          data: {
            modalidade,
            assentos,
            environment: getStripeEnvironment(),
            returnUrl: `${window.location.origin}/checkout-retorno?session_id={CHECKOUT_SESSION_ID}`,
            ...(rotaId ? { rotaId } : {}),
            ...(dataViagem ? { dataViagem } : {}),
          },
        });
        if ("error" in r) throw new Error(r.error);
        if (!r.clientSecret) throw new Error("O provedor não retornou a sessão de pagamento.");
        return r.clientSecret;
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
            <h2 className="font-display text-xl font-bold">Proteção RotaCerta</h2>
            <p className="text-sm text-muted-foreground">
              {modalidade === "mensal"
                ? "Cobertura de 30 dias para todas as suas saídas."
                : `Proteção desta viagem para ${assentos} assento(s).`}
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
        <div className="mt-5">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
