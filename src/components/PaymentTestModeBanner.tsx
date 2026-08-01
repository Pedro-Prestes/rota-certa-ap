const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        A cobrança online em produção ainda não está configurada. Conclua a ativação de pagamentos
        para receber valores reais.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-accent/40 bg-accent/15 px-4 py-2 text-center text-sm text-accent-foreground">
        Ambiente de teste: nenhuma cobrança feita aqui movimenta dinheiro real.
      </div>
    );
  }
  return null;
}
