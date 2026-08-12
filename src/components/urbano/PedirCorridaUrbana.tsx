import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, MapPin, Navigation, Star, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SeletorCidade } from "@/components/SeletorCidade";
import {
  CANCELAMENTO_COM_CUSTO,
  ROTULO_STATUS_URBANO,
  moeda,
  type PrecoUrbano,
  type StatusCorridaUrbana,
} from "@/lib/urbano";
import {
  avaliarCorridaUrbana,
  cancelarCorridaUrbana,
  estimarCorridaUrbana,
  minhasCorridasUrbanas,
  solicitarCorridaUrbana,
} from "@/utils/urbano.functions";

const cartao = "rounded-2xl border border-border bg-card p-5 shadow-sm";
const campo =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const rotulo = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const botao =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";

type Forma = "pix" | "credito" | "debito" | "dinheiro";

interface Estimativa {
  preco: PrecoUrbano;
  composicao: { taxaAdministrativa: number; total: number; itens: { rotulo: string; valor: number }[] };
  pico: boolean;
  taxaCancelamento: number;
}

interface Corrida {
  id: string;
  status: string;
  modo: string;
  origem_endereco: string;
  destino_endereco: string;
  distancia_km: number;
  duracao_min: number;
  total: number;
  taxa_cancelamento: number;
  agendada_para: string | null;
  avaliacao_motorista: number | null;
}

/** Pedido de corrida urbana pelo passageiro: preço antes de pedir, imediato ou agendado. */
export function PedirCorridaUrbana() {
  const qc = useQueryClient();
  const estimar = useServerFn(estimarCorridaUrbana);
  const pedir = useServerFn(solicitarCorridaUrbana);
  const listar = useServerFn(minhasCorridasUrbanas);
  const cancelar = useServerFn(cancelarCorridaUrbana);
  const avaliar = useServerFn(avaliarCorridaUrbana);

  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [modo, setModo] = useState<"imediato" | "agendado">("imediato");
  const [agendada, setAgendada] = useState("");
  const [forma, setForma] = useState<Forma>("pix");
  const [estimativa, setEstimativa] = useState<Estimativa | null>(null);

  const corridas = useQuery({
    queryKey: ["urbano", "passageiro"],
    queryFn: () => listar(),
    refetchInterval: 15000,
  });

  const dados = () => ({ municipio: cidade, uf, origem, destino });

  const mEstimar = useMutation({
    mutationFn: () => estimar({ data: dados() }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        setEstimativa(null);
        toast.error(r.error);
        return;
      }
      setEstimativa(r as unknown as Estimativa);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mPedir = useMutation({
    mutationFn: () =>
      pedir({
        data: {
          ...dados(),
          modo,
          formaPagamento: forma,
          ...(modo === "agendado" ? { agendadaPara: new Date(agendada).toISOString() } : {}),
        },
      }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const designado = "designado" in r ? r.designado : null;
      toast.success(
        modo === "agendado"
          ? designado
            ? `Corrida agendada e reservada para o motorista mais próximo (${designado.distanciaKm.toFixed(1)} km).`
            : "Corrida agendada. Assim que um motorista ficar disponível na região, ela será designada."
          : "Pedido enviado aos motoristas online.",
      );

      setEstimativa(null);
      qc.invalidateQueries({ queryKey: ["urbano"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCancelar = useMutation({
    mutationFn: (corridaId: string) =>
      cancelar({ data: { corridaId, motivo: "Cancelada pelo passageiro" } }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const taxa = (r as { taxaAplicada?: number }).taxaAplicada ?? 0;
      toast.success(taxa > 0 ? `Cancelada com taxa de ${moeda(taxa)}.` : "Corrida cancelada.");
      qc.invalidateQueries({ queryKey: ["urbano"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAvaliar = useMutation({
    mutationFn: (v: { corridaId: string; nota: number }) => avaliar({ data: v }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Obrigado pela avaliação!");
      qc.invalidateQueries({ queryKey: ["urbano"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preenchido = !!uf && !!cidade && origem.trim().length > 4 && destino.trim().length > 4;
  const lista = (corridas.data?.corridas ?? []) as Corrida[];
  const emAndamento = lista.filter(
    (c) => !["concluida", "cancelada", "expirada"].includes(c.status),
  );
  const historico = lista.filter((c) => ["concluida", "cancelada", "expirada"].includes(c.status));

  return (
    <div className="space-y-6">
      <section className={cartao}>
        <h2 className="font-display text-lg font-bold">Corrida urbana</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dentro da cidade, distritos e vilarejos: você vê o preço completo antes de pedir, com
          bandeirada, distância, tempo e taxa administrativa.
        </p>

        <div className="mt-5 space-y-4">
          <SeletorCidade
            titulo="Cidade da corrida"
            uf={uf}
            cidade={cidade}
            onChange={(v) => {
              setUf(v.uf);
              setCidade(v.cidade);
              setEstimativa(null);
            }}
          />

          <label className="block">
            <span className={rotulo}>Endereço de embarque</span>
            <input
              className={campo}
              value={origem}
              onChange={(e) => {
                setOrigem(e.target.value);
                setEstimativa(null);
              }}
              placeholder="Rua, número, bairro"
            />
          </label>

          <label className="block">
            <span className={rotulo}>Endereço de destino</span>
            <input
              className={campo}
              value={destino}
              onChange={(e) => {
                setDestino(e.target.value);
                setEstimativa(null);
              }}
              placeholder="Rua, número, bairro"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Quando</span>
              <select
                className={campo}
                value={modo}
                onChange={(e) => setModo(e.target.value as "imediato" | "agendado")}
              >
                <option value="imediato">Agora (pedido imediato)</option>
                <option value="agendado">Agendar horário</option>
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Pagamento</span>
              <select
                className={campo}
                value={forma}
                onChange={(e) => setForma(e.target.value as Forma)}
              >
                <option value="pix">Pix</option>
                <option value="credito">Cartão de crédito</option>
                <option value="debito">Cartão de débito</option>
                <option value="dinheiro">Espécie</option>
              </select>
            </label>
          </div>

          {modo === "agendado" && (
            <label className="block">
              <span className={rotulo}>Data e hora</span>
              <input
                type="datetime-local"
                className={campo}
                value={agendada}
                onChange={(e) => setAgendada(e.target.value)}
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => mEstimar.mutate()}
              disabled={!preenchido || mEstimar.isPending}
              className={`${botao} border border-border`}
            >
              {mEstimar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Timer className="size-4" />
              )}
              Calcular preço
            </button>
            <button
              type="button"
              onClick={() => mPedir.mutate()}
              disabled={
                !estimativa ||
                mPedir.isPending ||
                (modo === "agendado" && !agendada)
              }
              className={`${botao} bg-primary text-primary-foreground`}
            >
              {mPedir.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Navigation className="size-4" />
              )}
              {modo === "agendado" ? "Agendar corrida" : "Pedir agora"}
            </button>
          </div>
        </div>

        {estimativa && (
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-semibold">
              Total a pagar: {moeda(estimativa.composicao.total)}
              {estimativa.pico && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
                  horário de pico
                </span>
              )}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {estimativa.preco.itens.map((i) => (
                <li key={i.rotulo} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{i.rotulo}</span>
                  <span>{moeda(i.valor)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Taxa administrativa</span>
                <span>{moeda(estimativa.composicao.taxaAdministrativa)}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {estimativa.preco.distanciaKm} km • {estimativa.preco.duracaoMin} min estimados.
              Cancelamento após o motorista sair custa {moeda(estimativa.taxaCancelamento)}.
            </p>
          </div>
        )}
      </section>

      {emAndamento.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Acompanhamento</h2>
          {emAndamento.map((c) => (
            <article key={c.id} className={cartao}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {ROTULO_STATUS_URBANO[c.status as StatusCorridaUrbana] ?? c.status}
                </span>
                <span className="text-sm font-bold">{moeda(c.total)}</span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {c.origem_endereco}
              </p>
              <p className="mt-1 flex items-start gap-2 text-sm">
                <Navigation className="mt-0.5 size-4 shrink-0 text-primary" /> {c.destino_endereco}
              </p>
              {c.agendada_para && (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {new Date(c.agendada_para).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              )}
              <button
                type="button"
                onClick={() => mCancelar.mutate(c.id)}
                disabled={mCancelar.isPending}
                className={`${botao} mt-4 border border-border text-destructive`}
              >
                <XCircle className="size-4" />
                {CANCELAMENTO_COM_CUSTO.includes(c.status as StatusCorridaUrbana)
                  ? `Cancelar (taxa ${moeda(c.taxa_cancelamento)})`
                  : "Cancelar sem custo"}
              </button>
            </article>
          ))}
        </section>
      )}

      {historico.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Histórico urbano</h2>
          {historico.map((c) => (
            <article key={c.id} className={`${cartao} text-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {ROTULO_STATUS_URBANO[c.status as StatusCorridaUrbana] ?? c.status}
                </span>
                <span className="font-bold">{moeda(c.total)}</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {c.origem_endereco} → {c.destino_endereco}
              </p>
              {c.status === "concluida" && (
                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <button
                      key={nota}
                      type="button"
                      onClick={() => mAvaliar.mutate({ corridaId: c.id, nota })}
                      aria-label={`Avaliar com ${nota} estrela(s)`}
                    >
                      <Star
                        className={`size-5 ${
                          (c.avaliacao_motorista ?? 0) >= nota
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
