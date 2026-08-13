import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, Loader2, Ticket } from "lucide-react";
import { brl } from "@/lib/logistica";
import { PRAZO_OFERTA_MIN } from "@/lib/preco-dinamico";
import {
  aceitarOfertaComCreditos,
  cancelarPreReserva,
  minhasPreReservas,
} from "@/utils/pre-reserva.functions";
import { CheckoutPix } from "@/components/CheckoutPix";

interface Item {
  id: string;
  rota_id: string;
  data_viagem: string;
  assentos: number;
  assentos_bagagem: number;
  endereco: string;
  status: string;
  valor_ofertado: number | null;
  valor_base: number | null;
  taxa_desvio: number | null;
  fator_ocupacao: number | null;
  oferta_expira_em: string | null;
  rotas: {
    origem: string;
    destino: string;
    uf_origem: string | null;
    uf_destino: string | null;
    saida_ida: string | null;
    preco_assento: number | null;
    assentos: number | null;
  } | null;
}

const ROTULO: Record<string, string> = {
  pendente: "Aguardando o fechamento da saída",
  ofertada: "Valor enviado — pague para confirmar",
  confirmada: "Assento confirmado e pago",
  expirada: "Prazo de pagamento vencido",
  cancelada: "Cancelada",
};

const COR: Record<string, string> = {
  pendente: "bg-accent/15 text-accent-foreground",
  ofertada: "bg-primary/10 text-primary",
  confirmada: "bg-success/10 text-success",
  expirada: "bg-destructive/10 text-destructive",
  cancelada: "bg-secondary text-muted-foreground",
};

function restante(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function PreReservas() {
  const qc = useQueryClient();
  const listar = useServerFn(minhasPreReservas);
  const aceitar = useServerFn(aceitarOfertaComCreditos);
  const cancelar = useServerFn(cancelarPreReserva);
  const [, setTique] = useState(0);
  const [pixPrice, setPixPrice] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTique((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pre = useQuery({
    queryKey: ["minhas-pre-reservas"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const r = await listar();
      if ("error" in r) throw new Error(r.error);
      return (r.itens ?? []) as unknown as Item[];
    },
  });

  const pagar = useMutation({
    mutationFn: async (id: string) => {
      const r = await aceitar({ data: { preReservaId: id, environment: "live" } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      if (r.status === "sem_saldo") {
        toast.info(`Faltam ${brl(r.faltando)} em créditos. Complete pelo Pix para confirmar.`);
        setPixPrice(r.pacoteSugerido);
      } else {
        toast.success(`Assento confirmado! Pagamos ${brl(r.total)} com seus créditos.`);
      }
      void qc.invalidateQueries({ queryKey: ["minhas-pre-reservas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desistir = useMutation({
    mutationFn: async (id: string) => {
      const r = await cancelar({ data: { preReservaId: id, environment: "live" } });
      if ("error" in r) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Pré-reserva cancelada.");
      void qc.invalidateQueries({ queryKey: ["minhas-pre-reservas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = (pre.data ?? []).filter((i) => i.status !== "cancelada");

  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Ticket className="size-5 text-accent" /> Minhas pré-reservas
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        A saída é fechada 60 minutos antes do horário programado. Nesse momento calculamos o valor
        conforme o número de assentos reservados e o desvio até o seu embarque, e avisamos você por
        app, SMS, WhatsApp e e-mail. Você tem {PRAZO_OFERTA_MIN} minutos para confirmar pagando —
        senão a vaga passa ao próximo passageiro da fila.
      </p>

      {pre.isLoading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando suas pré-reservas…
        </p>
      )}
      {!pre.isLoading && itens.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Você ainda não tem pré-reservas. Escolha uma saída acima e clique em “Pré-reservar”.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {itens.map((i) => {
          const conta = i.status === "ofertada" ? restante(i.oferta_expira_em) : null;
          const vencido = conta === "00:00";
          return (
            <article
              key={i.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">
                    {i.rotas?.origem}/{i.rotas?.uf_origem} → {i.rotas?.destino}/
                    {i.rotas?.uf_destino}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {i.data_viagem} · saída{" "}
                    {i.rotas?.saida_ida?.slice(0, 5) ?? "--:--"} · {i.assentos} assento(s)
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Embarque: {i.endereco}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${COR[i.status] ?? ""}`}
                >
                  {ROTULO[i.status] ?? i.status}
                </span>
              </div>

              {i.status === "ofertada" && i.valor_ofertado != null && (
                <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <p className="font-display text-xl font-bold text-primary">
                    {brl(Number(i.valor_ofertado))}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Fator de ocupação {Number(i.fator_ocupacao ?? 1).toFixed(2)}x
                    {Number(i.taxa_desvio ?? 0) > 0
                      ? ` · desvio do seu embarque ${brl(Number(i.taxa_desvio))}`
                      : ""}
                    . Taxa administrativa inclusa.
                  </p>
                  <p className="mt-2 text-xs font-semibold">
                    {vencido ? "Prazo encerrado" : `Confirme em ${conta}`}
                  </p>
                  <button
                    onClick={() => pagar.mutate(i.id)}
                    disabled={pagar.isPending || vencido}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {pagar.isPending && <Loader2 className="size-4 animate-spin" />}
                    Aceitar e pagar com créditos
                  </button>
                </div>
              )}

              {i.status === "pendente" && (
                <button
                  onClick={() => desistir.mutate(i.id)}
                  disabled={desistir.isPending}
                  className="mt-4 w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
                >
                  Cancelar pré-reserva
                </button>
              )}
            </article>
          );
        })}
      </div>

      {pixPrice && <CheckoutPix priceId={pixPrice} onFechar={() => setPixPrice(null)} />}
    </section>
  );
}
