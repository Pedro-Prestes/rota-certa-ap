import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Play,
  Radio,
  ShieldCheck,
  Square,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { MapaViagem } from "@/components/MapaViagem";
import { CheckoutProtecao } from "@/components/CheckoutProtecao";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getStripeEnvironment, cobrancaOnlineDisponivel } from "@/lib/stripe";
import {
  COR_VIAGEM,
  ROTULO_VIAGEM,
  deveGravar,
  duracao,
  horaLocal,
  type Posicao,
  type StatusViagem,
} from "@/lib/rastreio";
import {
  COBERTURAS,
  COR_SINISTRO,
  ROTULO_SINISTRO,
  TIPOS_PANE,
  VALOR_PROTECAO_MENSAL,
  reais,
  type StatusSinistro,
} from "@/lib/seguro";
import { encerrarViagem, iniciarViagem, marcarEmViagem } from "@/utils/viagem.functions";
import { consultarCobertura, contratarProtecaoCreditos, reportarPane } from "@/utils/seguro.functions";
import { GuardaPerfil } from "@/components/GuardaPerfil";

export const Route = createFileRoute("/_authenticated/viagem")({
  head: () => ({
    meta: [
      { title: "Viagem ao vivo | RotaCerta" },
      {
        name: "description",
        content:
          "Transmita o trajeto da viagem em tempo real, acione a Proteção RotaCerta e registre panes com veículo substituto.",
      },
      { property: "og:title", content: "Viagem ao vivo | RotaCerta" },
      {
        property: "og:description",
        content: "Acompanhamento do trajeto por Starlink e assistência 24h em caso de pane.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ViagemAoVivoProtegido,
});

const campo =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const rotulo = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const hoje = () => new Date().toISOString().slice(0, 10);

function ViagemAoVivo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rotaId, setRotaId] = useState("");
  const [dataViagem, setDataViagem] = useState(hoje);
  const [veiculoId, setVeiculoId] = useState("");
  const [transmitindo, setTransmitindo] = useState(false);
  const [tipoPane, setTipoPane] = useState<string>(TIPOS_PANE[0]);
  const [descricaoPane, setDescricaoPane] = useState("");
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [oficinaNome, setOficinaNome] = useState("");
  const [oficinaEndereco, setOficinaEndereco] = useState("");
  const ultimaRef = useRef<Posicao | null>(null);
  const seqRef = useRef(0);

  const rotas = useQuery({
    queryKey: ["rotas-motorista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select("id, origem, destino, saida_ida")
        .eq("user_id", user!.id)
        .order("origem");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const veiculos = useQuery({
    queryKey: ["veiculos-motorista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo")
        .eq("user_id", user!.id)
        .order("placa");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const viagem = useQuery({
    queryKey: ["viagem", rotaId, dataViagem],
    enabled: !!rotaId && !!dataViagem,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viagens")
        .select("*")
        .eq("rota_id", rotaId)
        .eq("data_viagem", dataViagem)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const viagemId = viagem.data?.id as string | undefined;

  const posicoes = useQuery({
    queryKey: ["posicoes", viagemId],
    enabled: !!viagemId,
    refetchInterval: transmitindo ? 20_000 : 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viagem_posicoes")
        .select("latitude, longitude, velocidade_kmh, precisao_m, registrado_em, sequencia")
        .eq("viagem_id", viagemId!)
        .order("sequencia", { ascending: true });
      if (error) throw new Error(error.message);
      const lista = (data ?? []).map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        velocidade_kmh: p.velocidade_kmh,
        precisao_m: p.precisao_m,
        registrado_em: p.registrado_em,
      })) as Posicao[];
      seqRef.current = Math.max(seqRef.current, data?.length ? Number(data[data.length - 1]!.sequencia) : 0);
      ultimaRef.current = lista[lista.length - 1] ?? ultimaRef.current;
      return lista;
    },
  });

  const pontos = useQuery({
    queryKey: ["pontos-viagem", rotaId, dataViagem],
    enabled: !!rotaId && !!dataViagem,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_embarque")
        .select("id, passageiro_nome, endereco, latitude, longitude, ordem, eta_ponto, assentos, status")
        .eq("rota_id", rotaId)
        .eq("data_viagem", dataViagem)
        .eq("status", "aceito")
        .order("ordem", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const cobertura = useQuery({
    queryKey: ["cobertura", rotaId, dataViagem],
    enabled: !!rotaId && !!dataViagem,
    queryFn: async () => {
      const r = await consultarCobertura({
        data: { rotaId, dataViagem, environment: getStripeEnvironment() },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
  });

  const sinistro = useQuery({
    queryKey: ["sinistro", viagemId],
    enabled: !!viagemId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistros")
        .select("*")
        .eq("viagem_id", viagemId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const oficinas = useQuery({
    queryKey: ["oficinas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oficinas")
        .select("*")
        .eq("user_id", user!.id)
        .order("preferida", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  /* ------------------------------------------------ transmissão da posição */
  useEffect(() => {
    if (!transmitindo || !viagemId) return;
    if (!("geolocation" in navigator)) {
      toast.error("Este aparelho não permite acesso ao GPS.");
      setTransmitindo(false);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        const nova: Posicao = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          velocidade_kmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          precisao_m: Math.round(pos.coords.accuracy),
          registrado_em: new Date().toISOString(),
        };
        if (!deveGravar(ultimaRef.current, nova)) return;
        seqRef.current += 1;
        const { error } = await supabase.from("viagem_posicoes").insert({
          viagem_id: viagemId,
          sequencia: seqRef.current,
          latitude: nova.latitude,
          longitude: nova.longitude,
          velocidade_kmh: nova.velocidade_kmh ?? null,
          precisao_m: nova.precisao_m ?? null,
          registrado_em: nova.registrado_em,
        });
        if (error) {
          seqRef.current -= 1;
          return;
        }
        ultimaRef.current = nova;
        await supabase
          .from("viagens")
          .update({
            ultima_latitude: nova.latitude,
            ultima_longitude: nova.longitude,
            ultima_velocidade_kmh: nova.velocidade_kmh ?? null,
            ultima_posicao_em: nova.registrado_em,
          })
          .eq("id", viagemId);
        qc.invalidateQueries({ queryKey: ["posicoes", viagemId] });
      },
      () => toast.error("Não foi possível ler o GPS. Verifique a permissão de localização."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [transmitindo, viagemId, qc]);

  const emCurso = ["em_busca", "em_viagem", "interrompida"].includes(
    (viagem.data?.status as string) ?? "",
  );

  useEffect(() => {
    if (!emCurso) setTransmitindo(false);
  }, [emCurso]);

  const iniciar = useMutation({
    mutationFn: async () => {
      const r = await iniciarViagem({
        data: { rotaId, dataViagem, ...(veiculoId ? { veiculoId } : {}) },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: () => {
      toast.success("Viagem iniciada. Transmissão liberada.");
      setTransmitindo(true);
      viagem.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emViagem = useMutation({
    mutationFn: async () => {
      const r = await marcarEmViagem({ data: { viagemId: viagemId! } });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: () => {
      toast.success("Todos embarcados — viagem em curso.");
      viagem.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const encerrar = useMutation({
    mutationFn: async () => {
      const r = await encerrarViagem({
        data: { viagemId: viagemId!, environment: getStripeEnvironment() },
      });
      if ("error" in r) throw new Error((r as { error: string }).error);
      return r as { distanciaKm: number };
    },
    onSuccess: (r) => {
      setTransmitindo(false);
      toast.success(`Viagem concluída — ${r.distanciaKm} km registrados na auditoria.`);
      viagem.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contratarCreditos = useMutation({
    mutationFn: async () => {
      const r = await contratarProtecaoCreditos({
        data: { modalidade: "mensal", environment: getStripeEnvironment() },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Proteção ativada. Saldo restante: ${reais(r.saldoRestante ?? 0)}`);
      cobertura.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirPane = useMutation({
    mutationFn: async () => {
      const ultima = ultimaRef.current;
      const r = await reportarPane({
        data: {
          viagemId: viagemId!,
          tipoPane,
          descricao: descricaoPane,
          environment: getStripeEnvironment(),
          ...(ultima ? { latitude: ultima.latitude, longitude: ultima.longitude } : {}),
        },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: () => {
      setDescricaoPane("");
      toast.success("Chamado aberto. A assistência foi acionada.");
      sinistro.refetch();
      viagem.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarOficina = useMutation({
    mutationFn: async () => {
      if (oficinaNome.trim().length < 3) throw new Error("Informe o nome da oficina.");
      if (oficinaEndereco.trim().length < 5) throw new Error("Informe o endereço da oficina.");
      const { error } = await supabase.from("oficinas").insert({
        user_id: user!.id,
        nome: oficinaNome.trim(),
        endereco: oficinaEndereco.trim(),
        preferida: (oficinas.data ?? []).length === 0,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setOficinaNome("");
      setOficinaEndereco("");
      toast.success("Oficina cadastrada.");
      oficinas.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcosMapa = useMemo(
    () =>
      (pontos.data ?? [])
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          rotulo: `${p.ordem ?? "?"}º ${p.passageiro_nome.split(" ")[0]}`,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
        })),
    [pontos.data],
  );

  const status = (viagem.data?.status as StatusViagem) ?? "planejada";
  const chamado = sinistro.data;
  const protegida = cobertura.data?.protegida ?? false;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Rastreio por satélite
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Viagem ao vivo</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A conexão Starlink dos ramais permite transmitir a posição do veículo durante todo o
            trajeto. Passageiros, motorista e administração acompanham a mesma informação — e, em
            caso de pane, a Proteção RotaCerta despacha veículo substituto e reboque.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className={rotulo}>Saída</span>
                  <select className={campo} value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
                    <option value="">Selecione a rota</option>
                    {(rotas.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.origem} → {r.destino} · {(r.saida_ida ?? "").slice(0, 5)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={rotulo}>Data</span>
                  <input
                    type="date"
                    className={campo}
                    value={dataViagem}
                    onChange={(e) => setDataViagem(e.target.value)}
                  />
                </label>
                <label className="block sm:col-span-3">
                  <span className={rotulo}>Veículo da saída</span>
                  <select
                    className={campo}
                    value={veiculoId}
                    onChange={(e) => setVeiculoId(e.target.value)}
                  >
                    <option value="">Selecione o veículo</option>
                    {(veiculos.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.placa} — {v.marca} {v.modelo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${COR_VIAGEM[status]}`}>
                  {ROTULO_VIAGEM[status]}
                </span>
                {viagem.data?.iniciada_em && (
                  <span className="text-xs text-muted-foreground">
                    Em atividade há {duracao(viagem.data.iniciada_em, viagem.data.concluida_em)}
                  </span>
                )}
                {viagem.data?.distancia_percorrida_km ? (
                  <span className="text-xs text-muted-foreground">
                    {viagem.data.distancia_percorrida_km} km percorridos
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!emCurso && (
                  <button
                    onClick={() => iniciar.mutate()}
                    disabled={!rotaId || iniciar.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    {iniciar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Iniciar viagem
                  </button>
                )}
                {emCurso && (
                  <>
                    <button
                      onClick={() => setTransmitindo((v) => !v)}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold ${
                        transmitindo
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card"
                      }`}
                    >
                      <Radio className={`size-4 ${transmitindo ? "animate-pulse" : ""}`} />
                      {transmitindo ? "Transmitindo posição" : "Retomar transmissão"}
                    </button>
                    {status === "em_busca" && (
                      <button
                        onClick={() => emViagem.mutate()}
                        disabled={emViagem.isPending}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                      >
                        <CheckCircle2 className="size-4" /> Todos embarcados
                      </button>
                    )}
                    <button
                      onClick={() => encerrar.mutate()}
                      disabled={encerrar.isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {encerrar.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Square className="size-4" />
                      )}
                      Encerrar viagem
                    </button>
                  </>
                )}
              </div>

              <div className="mt-5">
                <MapaViagem posicoes={posicoes.data ?? []} pontos={marcosMapa} />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg font-bold">Pontos combinados da saída</h2>
              <div className="mt-4 space-y-2">
                {(pontos.data ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-sm"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {p.ordem ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.passageiro_nome}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {p.endereco}
                      </p>
                    </div>
                    <span className="text-xs font-semibold">{horaLocal(p.eta_ponto)}</span>
                  </div>
                ))}
                {(pontos.data ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum ponto de embarque acordado para esta saída.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`size-5 ${protegida ? "text-primary" : "text-muted-foreground"}`} />
                <h2 className="font-display text-lg font-bold">Proteção RotaCerta</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {protegida
                  ? `Saída protegida (${cobertura.data?.modalidade === "mensal" ? "plano mensal" : "cobertura avulsa"}) até ${horaLocal(cobertura.data?.vigenciaFim ?? null)}.`
                  : `Sem cobertura ativa para esta saída. O plano mensal custa ${reais(VALOR_PROTECAO_MENSAL)} e cobre todas as suas viagens por 30 dias.`}
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {COBERTURAS.map((c) => (
                  <li key={c} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    {c}
                  </li>
                ))}
              </ul>
              {!protegida && (
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={() => contratarCreditos.mutate()}
                    disabled={contratarCreditos.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    {contratarCreditos.isPending && <Loader2 className="size-4 animate-spin" />}
                    Ativar com créditos da carteira
                  </button>
                  {cobrancaOnlineDisponivel() && (
                    <button
                      onClick={() => setCheckoutAberto(true)}
                      className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
                    >
                      Pagar com Pix ou cartão
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                <h2 className="font-display text-lg font-bold">Registrar pane</h2>
              </div>
              {chamado && chamado.status !== "concluido" && chamado.status !== "cancelado" ? (
                <div className="mt-4 space-y-2 text-sm">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${COR_SINISTRO[chamado.status as StatusSinistro]}`}
                  >
                    {ROTULO_SINISTRO[chamado.status as StatusSinistro]}
                  </span>
                  <p className="text-muted-foreground">{chamado.tipo_pane}</p>
                  {chamado.substituto_placa && (
                    <p>
                      Substituto <strong>{chamado.substituto_placa}</strong> ({chamado.substituto_motorista})
                      {chamado.substituto_eta ? ` — chega ${horaLocal(chamado.substituto_eta)}` : ""}
                    </p>
                  )}
                  {chamado.reboque_em && <p>Reboque acionado às {horaLocal(chamado.reboque_em)}.</p>}
                </div>
              ) : (
                <>
                  <label className="mt-4 block">
                    <span className={rotulo}>Tipo de pane</span>
                    <select className={campo} value={tipoPane} onChange={(e) => setTipoPane(e.target.value)}>
                      {TIPOS_PANE.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block">
                    <span className={rotulo}>O que aconteceu</span>
                    <textarea
                      rows={3}
                      maxLength={500}
                      className={campo}
                      value={descricaoPane}
                      onChange={(e) => setDescricaoPane(e.target.value)}
                      placeholder="Descreva a situação para a assistência"
                    />
                  </label>
                  <button
                    onClick={() => abrirPane.mutate()}
                    disabled={!viagemId || abrirPane.isPending}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
                  >
                    {abrirPane.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="size-4" />
                    )}
                    Acionar assistência
                  </button>
                  {!protegida && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      É necessária cobertura ativa nesta saída para abrir o chamado.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Wrench className="size-5 text-accent" />
                <h2 className="font-display text-lg font-bold">Oficinas de confiança</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                O reboque leva o veículo para a primeira oficina da lista.
              </p>
              <div className="mt-4 space-y-2">
                {(oficinas.data ?? []).map((o) => (
                  <div key={o.id} className="rounded-xl bg-secondary px-4 py-3 text-sm">
                    <p className="font-semibold">
                      {o.nome} {o.preferida ? "· preferida" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{o.endereco}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className={rotulo}>Nome</span>
                  <input className={campo} value={oficinaNome} onChange={(e) => setOficinaNome(e.target.value)} />
                </label>
                <label className="block">
                  <span className={rotulo}>Endereço</span>
                  <input
                    className={campo}
                    value={oficinaEndereco}
                    onChange={(e) => setOficinaEndereco(e.target.value)}
                  />
                </label>
                <button
                  onClick={() => salvarOficina.mutate()}
                  disabled={salvarOficina.isPending}
                  className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Cadastrar oficina
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {checkoutAberto && (
        <CheckoutProtecao
          modalidade="mensal"
          onFechar={() => {
            setCheckoutAberto(false);
            cobertura.refetch();
          }}
        />
      )}
    </div>
  );
}

function ViagemAoVivoProtegido() {
  return (
    <GuardaPerfil perfis={["motorista","frotista"]}>
      <ViagemAoVivo />
    </GuardaPerfil>
  );
}
