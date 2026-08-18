import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Power,
  RefreshCw,
  Star,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SeletorCidade } from "@/components/SeletorCidade";
import { useBipDeNovidades } from "@/hooks/use-bip";
import { tocarBip } from "@/lib/bip";
import {
  ETAPAS_URBANAS,
  RAIO_DESPACHO_KM,
  ROTULO_STATUS_URBANO,
  moeda,
  proximaEtapa,
  type StatusCorridaUrbana,
} from "@/lib/urbano";
import {
  aceitarCorridaUrbana,
  avancarEtapaUrbana,
  cancelarCorridaUrbana,
  converterModoUrbano,
  definirDisponibilidadeUrbana,
  painelUrbanoMotorista,
} from "@/utils/urbano.functions";

interface Corrida {
  id: string;
  status: string;
  modo: string;
  municipio: string;
  uf: string;
  origem_endereco: string;
  destino_endereco: string;
  distancia_km: number;
  duracao_min: number;
  base: number;
  total: number;
  forma_pagamento: string;
  agendada_para: string | null;
  avaliacao_passageiro: number | null;
  distanciaAteEmbarqueKm?: number | null;
}

const cartao = "rounded-2xl border border-border bg-card p-5 shadow-sm";
const botao =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";

/** Painel de despacho urbano do motorista: chave de conversão, ofertas e etapas. */
export function PainelUrbanoMotorista() {
  const qc = useQueryClient();
  const buscar = useServerFn(painelUrbanoMotorista);
  const converter = useServerFn(converterModoUrbano);
  const disponibilidade = useServerFn(definirDisponibilidadeUrbana);
  const aceitar = useServerFn(aceitarCorridaUrbana);
  const avancar = useServerFn(avancarEtapaUrbana);
  const cancelar = useServerFn(cancelarCorridaUrbana);

  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");

  const painel = useQuery({
    queryKey: ["urbano", "motorista"],
    queryFn: () => buscar(),
    refetchInterval: 15000,
  });

  const estado = painel.data?.estado ?? null;
  useEffect(() => {
    if (estado?.uf) setUf(estado.uf);
    if (estado?.municipio) setCidade(estado.municipio);
  }, [estado?.uf, estado?.municipio]);

  const atualizar = () => qc.invalidateQueries({ queryKey: ["urbano"] });
  const aviso = (r: unknown) => {
    const erro = (r as { error?: string })?.error;
    if (erro) {
      toast.error(erro);
      return false;
    }
    atualizar();
    return true;
  };

  const mChave = useMutation({
    mutationFn: async (ativo: boolean) =>
      converter({ data: ativo ? { ativo: true, municipio: cidade, uf } : { ativo: false } }),
    onSuccess: (r) => {
      if (aviso(r)) toast.success("Modo urbano atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mOnline = useMutation({
    mutationFn: async (online: boolean) => {
      const posicao = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!("geolocation" in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 },
        );
      });
      return disponibilidade({
        data: {
          online,
          ...(posicao
            ? { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }
            : {}),
        },
      });
    },
    onSuccess: (r) => {
      if (aviso(r)) toast.success("Situação atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAceitar = useMutation({
    mutationFn: (corridaId: string) => aceitar({ data: { corridaId } }),
    onSuccess: (r) => {
      if (aviso(r)) {
        tocarBip("aceite_urbano");
        toast.success("Corrida aceita. Siga para o embarque.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mAvancar = useMutation({
    mutationFn: (corridaId: string) => avancar({ data: { corridaId } }),
    onSuccess: (r) => {
      if (aviso(r)) toast.success("Etapa registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCancelar = useMutation({
    mutationFn: (corridaId: string) =>
      cancelar({ data: { corridaId, motivo: "Cancelada pelo motorista" } }),
    onSuccess: (r) => {
      if (aviso(r)) toast.success("Corrida cancelada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ofertas = (painel.data?.ofertas ?? []) as Corrida[];
  const minhas = (painel.data?.minhas ?? []) as Corrida[];
  const ativo = !!estado?.ativo;
  const online = !!estado?.online;
  const podeAtivar = useMemo(() => !!uf && !!cidade, [uf, cidade]);

  // Bip de chamada urbana sempre que uma nova oferta entra na prateleira.
  useBipDeNovidades(
    ofertas.map((c) => c.id),
    "chamada_urbana",
    ativo && online,
  );

  return (
    <div className="space-y-6">
      <section className={cartao}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">Chave de conversão urbana</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Ligue a chave para receber corridas urbanas na sua cidade metropolitana, distritos e
              vilarejos. Ofertas são despachadas num raio de {RAIO_DESPACHO_KM} km da sua posição.
            </p>
          </div>
          <button
            type="button"
            onClick={() => mChave.mutate(!ativo)}
            disabled={mChave.isPending || (!ativo && !podeAtivar)}
            className={`${botao} ${ativo ? "bg-primary text-primary-foreground" : "border border-border"}`}
          >
            {mChave.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : ativo ? (
              <ToggleRight className="size-4" />
            ) : (
              <ToggleLeft className="size-4" />
            )}
            {ativo ? "Modo urbano ligado" : "Ligar modo urbano"}
          </button>
        </div>

        <div className="mt-5">
          <SeletorCidade
            titulo="Município-base do modo urbano"
            uf={uf}
            cidade={cidade}
            onChange={(v) => {
              setUf(v.uf);
              setCidade(v.cidade);
            }}
          />
        </div>

        {ativo && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => mOnline.mutate(!online)}
              disabled={mOnline.isPending}
              className={`${botao} ${online ? "bg-emerald-600 text-white" : "border border-border"}`}
            >
              {mOnline.isPending ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
              {online ? "Online — recebendo corridas" : "Ficar online"}
            </button>
            <button type="button" onClick={atualizar} className={`${botao} border border-border`}>
              <RefreshCw className="size-4" /> Atualizar ofertas
            </button>
            {estado?.ultima_posicao_em && (
              <span className="text-xs text-muted-foreground">
                Posição enviada às{" "}
                {new Date(estado.ultima_posicao_em).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}
      </section>

      {minhas.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Corrida em andamento</h2>
          {minhas.map((c) => {
            const proxima = proximaEtapa(c.status);
            return (
              <article key={c.id} className={cartao}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {ROTULO_STATUS_URBANO[c.status as StatusCorridaUrbana] ?? c.status}
                  </span>
                  <span className="text-sm font-bold">{moeda(c.total)}</span>
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {c.origem_endereco}
                </p>
                <p className="mt-1 flex items-start gap-2 text-sm">
                  <Navigation className="mt-0.5 size-4 shrink-0 text-primary" />
                  {c.destino_endereco}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.distancia_km} km • {c.duracao_min} min • pagamento {c.forma_pagamento}
                </p>
                <ol className="mt-3 flex flex-wrap gap-2 text-xs">
                  {ETAPAS_URBANAS.map((etapa) => (
                    <li
                      key={etapa}
                      className={`rounded-full px-2.5 py-1 ${
                        etapa === c.status
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ROTULO_STATUS_URBANO[etapa]}
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex flex-wrap gap-2">
                  {proxima && (
                    <button
                      type="button"
                      onClick={() => mAvancar.mutate(c.id)}
                      disabled={mAvancar.isPending}
                      className={`${botao} bg-primary text-primary-foreground`}
                    >
                      {mAvancar.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {proxima === "concluida"
                        ? "Concluir corrida"
                        : `Marcar: ${ROTULO_STATUS_URBANO[proxima]}`}
                    </button>
                  )}
                  <a
                    className={`${botao} border border-border`}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      c.status === "em_viagem" ? c.destino_endereco : c.origem_endereco,
                    )}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="size-4" /> Navegar
                  </a>
                  <button
                    type="button"
                    onClick={() => mCancelar.mutate(c.id)}
                    disabled={mCancelar.isPending}
                    className={`${botao} border border-border text-destructive`}
                  >
                    <XCircle className="size-4" /> Cancelar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Ofertas na sua cidade</h2>
        {painel.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando ofertas…
          </p>
        ) : !ativo ? (
          <p className="text-sm text-muted-foreground">
            Ligue a chave de conversão para visualizar as corridas urbanas.
          </p>
        ) : ofertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma corrida disponível agora. Mantenha-se online para receber os próximos pedidos.
          </p>
        ) : (
          ofertas.map((c) => (
            <article key={c.id} className={cartao}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Car className="size-4" />
                  {c.modo === "agendado" && c.agendada_para
                    ? `Agendada para ${new Date(c.agendada_para).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}`
                    : "Pedido imediato"}
                </span>
                <span className="text-sm font-bold">{moeda(c.total)}</span>
              </div>
              <p className="mt-3 text-sm">
                <strong>Embarque:</strong> {c.origem_endereco}
              </p>
              <p className="mt-1 text-sm">
                <strong>Destino:</strong> {c.destino_endereco}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {c.distancia_km} km • {c.duracao_min} min • você recebe sobre a base{" "}
                {moeda(c.base)}
                {c.distanciaAteEmbarqueKm != null
                  ? ` • ${c.distanciaAteEmbarqueKm} km até o embarque`
                  : ""}
              </p>
              {c.avaliacao_passageiro != null && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3.5" /> Passageiro avaliado em {c.avaliacao_passageiro}
                </p>
              )}
              <button
                type="button"
                onClick={() => mAceitar.mutate(c.id)}
                disabled={mAceitar.isPending}
                className={`${botao} mt-4 bg-primary text-primary-foreground`}
              >
                {mAceitar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Aceitar corrida
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
