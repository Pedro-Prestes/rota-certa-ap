import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import {
  consultarPixMercadoPago,
  gerarPixMercadoPago,
  previaValorPix,
} from "@/utils/mercadopago.functions";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

interface Previa {
  base: number;
  taxaPercentual: number;
  taxaFixa: number;
  taxaAdmin: number;
  total: number;
  creditos: number;
  descricao: string;
}

interface Pix {
  pagamentoId: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiraEm: string | null;
  composicao: { base: number; taxaAdmin: number; total: number };
  creditos: number;
}

export function CheckoutPix({
  priceId,
  titulo = "Pagar com Pix",
  carregarPrevia,
  gerarPix,
  onFechar,
  onAprovado,
}: {
  priceId?: string;
  titulo?: string;
  /** Prévia customizada (ex.: valor exato da corrida). */
  carregarPrevia?: () => Promise<Previa>;
  /** Geração customizada do Pix (ex.: cobrança avulsa da corrida). */
  gerarPix?: (cpf?: string) => Promise<Pix>;
  onFechar: () => void;
  onAprovado: () => void;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState<Pix | null>(null);
  const [gerando, setGerando] = useState(false);
  const [aprovado, setAprovado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const promessa = carregarPrevia
      ? carregarPrevia()
      : previaValorPix({ data: { priceId: priceId as string } }).then((r) => r as Previa);
    void promessa
      .then((r) => ativo && setPrevia(r))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Não foi possível calcular o valor."),
      );
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceId]);

  useEffect(() => {
    if (!pix || aprovado) return;
    const timer = setInterval(async () => {
      const r = await consultarPixMercadoPago({ data: { pagamentoId: pix.pagamentoId } });
      if (r && "status" in r && r.status === "approved") {
        setAprovado(true);
        toast.success("Pix confirmado! Créditos adicionados à sua carteira.");
        onAprovado();
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pix, aprovado]);

  const gerar = async () => {
    setGerando(true);
    try {
      const cpfLimpo = cpf.replace(/\D/g, "").length === 11 ? cpf : undefined;
      if (gerarPix) {
        setPix(await gerarPix(cpfLimpo));
        return;
      }
      const r = await gerarPixMercadoPago({
        data: { priceId: priceId as string, ...(cpfLimpo ? { cpf: cpfLimpo } : {}) },
      });
      if (r && "error" in r) throw new Error(r.error);
      setPix(r as unknown as Pix);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o Pix.");
    } finally {
      setGerando(false);
    }
  };


  const validade = useMemo(
    () => (pix?.expiraEm ? new Date(pix.expiraEm).toLocaleString("pt-BR") : null),
    [pix],
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Pagar com Pix</h2>
            <p className="text-sm text-muted-foreground">
              {previa?.descricao ?? "Calculando o valor da cobrança…"}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto rounded-full border border-border p-2"
            aria-label="Fechar pagamento Pix"
          >
            <X className="size-4" />
          </button>
        </div>

        {previa && (
          <dl className="mt-5 space-y-2 rounded-xl border border-border p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Valor do plano/pacote</dt>
              <dd className="font-medium">{brl(previa.base)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Taxa administrativa ({previa.taxaPercentual}% + {brl(previa.taxaFixa)})
              </dt>
              <dd className="font-medium">{brl(previa.taxaAdmin)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold">Total no Pix</dt>
              <dd className="font-display text-lg font-bold">{brl(previa.total)}</dd>
            </div>
            <p className="text-xs text-muted-foreground">
              Você recebe {brl(previa.creditos)} em créditos na carteira assim que o Pix for
              confirmado.
            </p>
          </dl>
        )}

        {!pix ? (
          <div className="mt-5 space-y-3">
            <label className="block text-sm font-medium" htmlFor="cpf-pix">
              CPF do pagador (opcional)
            </label>
            <input
              id="cpf-pix"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <button
              onClick={gerar}
              disabled={gerando || !previa}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {gerando ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
              Gerar QR Code Pix
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 text-center">
            {pix.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code Pix para pagamento na RotaCerta"
                className="mx-auto size-56 rounded-xl border border-border bg-white p-2"
              />
            )}
            {pix.qrCode && (
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(pix.qrCode ?? "");
                  toast.success("Código Pix copiado.");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                <Copy className="size-4" /> Copiar código Pix
              </button>
            )}
            {validade && (
              <p className="text-xs text-muted-foreground">Este código vence em {validade}.</p>
            )}
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {aprovado ? (
                "Pagamento confirmado."
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin" /> Aguardando a confirmação do
                  pagamento…
                </>
              )}
            </p>
            {pix.ticketUrl && (
              <a
                href={pix.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs underline"
              >
                Abrir comprovante no Mercado Pago
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
