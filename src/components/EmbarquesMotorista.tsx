import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Clock, Loader2, MapPin, Navigation, Route as RouteIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { localizarEndereco, planejarEmbarque } from "@/utils/embarque.functions";
import { COR_STATUS_PONTO, STATUS_PONTO, horaLocal, type StatusPonto } from "@/lib/embarque";
import { brl } from "@/lib/logistica";
import { NavegacaoEmbarque } from "@/components/NavegacaoEmbarque";

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

interface RotaMotorista {
  id: string;
  origem: string;
  destino: string;
  uf_origem?: string | null;
  uf_destino?: string | null;
  saida_ida: string | null;
}


interface PontoRow {
  id: string;
  passageiro_nome: string;
  telefone: string | null;
  endereco: string;
  referencia: string | null;
  assentos: number;
  status: StatusPonto;
  ordem: number | null;
  eta_ponto: string | null;
  saida_motorista: string | null;
  latitude: number;
  longitude: number;
}

interface PlanoRow {
  distancia_busca_km: number;
  duracao_busca_min: number;
  custo_busca: number;
  saida_motorista: string;
  partida_garantida: string;
  provedor: string;
}

/**
 * Painel do motorista: acordo do ponto de embarque com cada passageiro e
 * cálculo da rota de busca otimizada que preserva o horário de partida.
 */
export function EmbarquesMotorista({ rotas }: { rotas: RotaMotorista[] }) {
  const qc = useQueryClient();
  const geocodificar = useServerFn(localizarEndereco);
  const planejar = useServerFn(planejarEmbarque);

  const [rotaId, setRotaId] = useState(rotas[0]?.id ?? "");
  const [dataViagem, setDataViagem] = useState(() => new Date().toISOString().slice(0, 10));
  const [contra, setContra] = useState<{ id: string; endereco: string; motivo: string } | null>(null);

  const rotaAtual = useMemo(() => rotas.find((r) => r.id === rotaId) ?? null, [rotas, rotaId]);

  const pontos = useQuery({
    queryKey: ["pontos-motorista", rotaId, dataViagem],
    enabled: !!rotaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_embarque")
        .select(
          "id, passageiro_nome, telefone, endereco, referencia, assentos, status, ordem, eta_ponto, saida_motorista, latitude, longitude",
        )
        .eq("rota_id", rotaId)
        .eq("data_viagem", dataViagem)
        .order("ordem", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as PontoRow[];
    },
  });

  const plano = useQuery({
    queryKey: ["plano-embarque", rotaId, dataViagem],
    enabled: !!rotaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_embarque")
        .select(
          "distancia_busca_km, duracao_busca_min, custo_busca, saida_motorista, partida_garantida, provedor",
        )
        .eq("rota_id", rotaId)
        .eq("data_viagem", dataViagem)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PlanoRow | null;
    },
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["pontos-motorista"] });
    void qc.invalidateQueries({ queryKey: ["plano-embarque"] });
  };

  const decidir = useMutation({
    mutationFn: async (dados: { id: string; status: StatusPonto; motivo?: string }) => {
      const { error } = await supabase
        .from("pontos_embarque")
        .update({ status: dados.status, motivo: dados.motivo ?? null })
        .eq("id", dados.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ponto atualizado.");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviarContra = useMutation({
    mutationFn: async () => {
      if (!contra) return;
      const local = await geocodificar({
        data: {
          endereco: contra.endereco,
          ...(rotaAtual?.uf_origem ? { uf: rotaAtual.uf_origem } : {}),
        },
      });
      if ("error" in local) throw new Error(local.error);
      const { error } = await supabase
        .from("pontos_embarque")
        .update({
          status: "contraproposta",
          contra_endereco: local.enderecoFormatado,
          contra_latitude: local.latitude,
          contra_longitude: local.longitude,
          motivo: contra.motivo || null,
        })
        .eq("id", contra.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contraproposta enviada ao passageiro.");
      setContra(null);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const otimizar = useMutation({
    mutationFn: async () => {
      const r = await planejar({ data: { rotaId, dataViagem } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        `Rota de busca traçada: ${r.distanciaKm} km em ${r.duracaoMin} min. Saída às ${horaLocal(r.saidaMotorista)}.`,
      );
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aceitos = (pontos.data ?? []).filter((p) => p.status === "aceito");

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Rota</span>
          <select className={campo} value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
            {rotas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.origem} → {r.destino} · {(r.saida_ida ?? "").slice(0, 5)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Data</span>
          <input
            type="date"
            className={campo}
            value={dataViagem}
            onChange={(e) => setDataViagem(e.target.value)}
          />
        </label>
        <button
          onClick={() => otimizar.mutate()}
          disabled={!rotaId || aceitos.length === 0 || otimizar.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          {otimizar.isPending ? <Loader2 className="size-4 animate-spin" /> : <RouteIcon className="size-4" />}
          Traçar rota de busca
        </button>
      </div>

      {plano.data && (
        <div className="rounded-3xl border border-border surface-night p-5 text-primary-foreground shadow-[var(--shadow-lift)]">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Navigation className="size-4 text-accent" /> Plano de busca georreferenciado
          </h3>
          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Sair da base às", horaLocal(plano.data.saida_motorista)],
              ["Partida garantida", horaLocal(plano.data.partida_garantida)],
              ["Percurso de busca", `${plano.data.distancia_busca_km} km · ${plano.data.duracao_busca_min} min`],
              ["Custo estimado", brl(Number(plano.data.custo_busca))],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-primary-foreground/60">{k}</dt>
                <dd className="font-display text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-primary-foreground/55">
            Sequência otimizada por {plano.data.provedor === "google_routes" ? "malha viária real (Google Routes)" : "estimativa geodésica"} —
            base → pontos acordados → saída da cidade, com 3 min de embarque por ponto e 10 min de folga.
          </p>
        </div>
      )}

      {plano.data && aceitos.length > 0 && (
        <NavegacaoEmbarque
          paradas={aceitos.map((p) => ({
            id: p.id,
            passageiro_nome: p.passageiro_nome,
            telefone: p.telefone,
            endereco: p.endereco,
            referencia: p.referencia,
            assentos: p.assentos,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            ordem: p.ordem,
            eta_ponto: p.eta_ponto,
          }))}
        />
      )}

      <div className="space-y-3">
        {(pontos.data ?? []).map((p) => (
          <article key={p.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-bold">
                  {p.ordem ? `${p.ordem}º · ` : ""}
                  {p.passageiro_nome}
                </p>
                <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                  {p.endereco}
                  {p.referencia ? ` — ${p.referencia}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.assentos} assento(s)
                  {p.telefone ? ` · ${p.telefone}` : ""}
                  {p.eta_ponto ? ` · chegada ${horaLocal(p.eta_ponto)}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${COR_STATUS_PONTO[p.status]}`}>
                {STATUS_PONTO[p.status]}
              </span>
            </div>

            {p.status !== "aceito" && p.status !== "cancelado" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => decidir.mutate({ id: p.id, status: "aceito" })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
                >
                  <Check className="size-3" /> Aceitar ponto
                </button>
                <button
                  onClick={() => setContra({ id: p.id, endereco: "", motivo: "" })}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                >
                  Sugerir outro ponto
                </button>
                <button
                  onClick={() =>
                    decidir.mutate({
                      id: p.id,
                      status: "recusado",
                      motivo: "Ponto fora do trajeto viável para garantir o horário de saída.",
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive"
                >
                  <X className="size-3" /> Recusar
                </button>
              </div>
            )}

            {contra?.id === p.id && (
              <div className="mt-4 space-y-2 rounded-2xl bg-secondary p-4">
                <input
                  className={campo}
                  placeholder="Endereço alternativo (rua, número, bairro)"
                  value={contra.endereco}
                  onChange={(e) => setContra({ ...contra, endereco: e.target.value })}
                />
                <input
                  className={campo}
                  placeholder="Motivo (opcional)"
                  value={contra.motivo}
                  onChange={(e) => setContra({ ...contra, motivo: e.target.value })}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => enviarContra.mutate()}
                    disabled={enviarContra.isPending}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    {enviarContra.isPending ? <Loader2 className="size-3 animate-spin" /> : <Clock className="size-3" />}
                    Enviar contraproposta
                  </button>
                  <button
                    onClick={() => setContra(null)}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {(pontos.data ?? []).length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum ponto proposto para {rotaAtual ? `${rotaAtual.origem} → ${rotaAtual.destino}` : "esta rota"} em{" "}
            {dataViagem}.
          </p>
        )}
      </div>
    </div>
  );
}
