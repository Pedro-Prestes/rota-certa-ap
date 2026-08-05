import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Receipt } from "lucide-react";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/checkout-retorno")({
  head: () => ({
    meta: [
      { title: "Cobrança concluída — RotaCerta" },
      {
        name: "description",
        content:
          "Confirmação da cobrança da corrida no RotaCerta, com registro contábil e bloco de auditoria gerados automaticamente.",
      },
      { property: "og:title", content: "Cobrança concluída — RotaCerta" },
      {
        property: "og:description",
        content: "Recibo da cobrança da corrida com registro contábil e auditoria em cadeia de blocos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  component: CheckoutRetorno,
});

function CheckoutRetorno() {
  const { session_id } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        {session_id ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h1 className="mt-4 font-display text-3xl font-bold">Cobrança processada</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              O pagamento foi enviado ao provedor. Assim que a confirmação chegar, o RotaCerta grava o
              recebimento, os lançamentos contábeis (incluindo a taxa administrativa) e o bloco de
              auditoria da corrida — tudo automaticamente.
            </p>
            <p className="mt-4 break-all rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
              Sessão: {session_id}
            </p>
          </>
        ) : (
          <>
            <Receipt className="mx-auto size-12 text-muted-foreground" />
            <h1 className="mt-4 font-display text-3xl font-bold">Nada a confirmar</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Não recebemos os dados da sessão de pagamento.
            </p>
          </>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/pagamentos"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Ver pagamentos
          </Link>
          <Link to="/auditoria" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
            Ver auditoria
          </Link>
        </div>
      </main>
    </div>
  );
}
