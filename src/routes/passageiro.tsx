import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Clock, Loader2, Luggage, MapPin, Users, Wallet } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CheckoutPix } from "@/components/CheckoutPix";
import { PreReservas } from "@/components/PreReservas";
import { PedirCorridaUrbana } from "@/components/urbano/PedirCorridaUrbana";
import { supabase } from "@/integrations/supabase/client";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL, frota } from "@/lib/dados";
import { ANTECEDENCIA_FECHAMENTO_MIN, faixaEstimada } from "@/lib/preco-dinamico";
import { criarPreReserva } from "@/utils/pre-reserva.functions";
import {
  gerarPixDaCorrida,
  pagarReservaComCreditos,
  previaDaReserva,
} from "@/utils/reserva.functions";

import {
  FRANQUIA_EXCLUSIVA_KG,
  PRECO_KG_EXCEDENTE,
  avaliarBagagem,
  brl,
  calcularTarifa,
  custoPesoExcedente,
  pesoExcedenteKg,
  rotuloClasse,
  type Volume,
} from "@/lib/logistica";

type RotaPublica = {
  id: string;
  origem: string;
  destino: string;
  uf_origem: string | null;
  uf_destino: string | null;

  saida_ida: string | null;
  chegada_ida: string | null;
  saida_retorno: string | null;
  distancia_km: number;
  assentos: number;
  travessias: number;
  dificuldade_via: number;
  preco_assento: number;
};

export const Route = createFileRoute("/passageiro")({
  head: () => ({
    meta: [
      { title: "Reservar assento e bagagem | RotaCerta Brasil" },
      {
        name: "description",
        content:
          "Busque rotas municipais e interestaduais em todo o Brasil, calcule o volume da sua bagagem e garanta o assento com pagamento antecipado.",
      },
      { property: "og:title", content: "Reservar assento e bagagem | RotaCerta" },
      {
        property: "og:description",
        content: "Agenda de rotas, cálculo de bagagem por IA e reserva de lotação paga antes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rotacertabrasil.com.br/passageiro" },
      { property: "og:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://rotacertabrasil.com.br/og-rotacerta.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://rotacertabrasil.com.br/passageiro" }],

  }),
  component: Passageiro,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

const hora = (v: string | null) => (v ? v.slice(0, 5) : "--:--");

function diaLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Passageiro() {
  const [origem, setOrigem] = useState("Macapá (sede)");
  const [destino, setDestino] = useState("");
  /** Relógio que avança a cada minuto para retirar embarques já vencidos. */
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hoje = diaLocal(agora);
  const [data, setData] = useState(() => diaLocal(new Date()));
  const [assentos, setAssentos] = useState(1);
  const [exclusiva, setExclusiva] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const [pagando, setPagando] = useState(false);
  const [pixPrice, setPixPrice] = useState<string | null>(null);
  const [pixCorrida, setPixCorrida] = useState(false);
  const [endereco, setEndereco] = useState("");
  const [enderecoDebounced, setEnderecoDebounced] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setEnderecoDebounced(endereco.trim()), 700);
    return () => clearTimeout(t);
  }, [endereco]);

  const enderecoValido = enderecoDebounced.length >= 6;


  const [bag, setBag] = useState<Volume>({
    comprimentoCm: 55,
    larguraCm: 35,
    alturaCm: 25,
    pesoKg: 8,
    quantidade: 1,
  });

  const rotas = useQuery({
    queryKey: ["rotas-publicas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select(
          "id, origem, destino, uf_origem, uf_destino, saida_ida, chegada_ida, saida_retorno, distancia_km, assentos, travessias, dificuldade_via, preco_assento",
        )
        .eq("status", "ativa")
        .order("saida_ida", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RotaPublica[];
    },
  });

  const todas = rotas.data ?? [];

  /** Localidades ofertadas em qualquer estado, no formato "Cidade/UF". */
  const localidades = useMemo(() => {
    const nomes = new Set<string>();
    for (const r of todas) {
      nomes.add(`${r.origem}/${r.uf_origem ?? "AP"}`);
      nomes.add(`${r.destino}/${r.uf_destino ?? "AP"}`);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [todas]);

  /**
   * A rota cadastrada é recorrente (permanece ativa até o motorista alterar ou
   * excluir). Na prateleira só aparecem embarques ainda por acontecer: no dia
   * de hoje, saídas cujo horário já passou (com 15 min de antecedência mínima)
   * ficam ocultas e voltam a ser ofertadas nas datas seguintes.
   */
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes() + 15;
  const ehHoje = data === hoje;

  const resultados = useMemo(
    () =>
      todas.filter((r) => {
        if (origem && `${r.origem}/${r.uf_origem ?? "AP"}` !== origem) return false;
        if (destino && `${r.destino}/${r.uf_destino ?? "AP"}` !== destino) return false;
        if (data < hoje) return false;
        if (!ehHoje) return true;
        const [h, m] = (r.saida_ida ?? "00:00").split(":");
        return Number(h) * 60 + Number(m) >= minutosAgora;
      }),
    [todas, origem, destino, data, hoje, ehHoje, minutosAgora],
  );

  useEffect(() => {
    if (selecionada && !resultados.some((r) => r.id === selecionada)) setSelecionada(null);
  }, [resultados, selecionada]);

  const viagem = todas.find((r) => r.id === selecionada) ?? null;

  const veiculo = frota[2]!;

  const avaliacao = useMemo(() => avaliarBagagem([bag], veiculo), [bag, veiculo]);

  const tarifa = useMemo(
    () =>
      viagem
        ? calcularTarifa({
            distanciaKm: Number(viagem.distancia_km),
            dificuldadeVia: Number(viagem.dificuldade_via),
            precoCombustivel: PRECO_COMBUSTIVEL,
            consumoKmL: CONSUMO_KM_L,
            assentos: viagem.assentos || veiculo.assentos,
            ocupacaoMedia: 0.78,
            travessias: viagem.travessias,
          })
        : null,
    [viagem, veiculo],
  );

  const total = tarifa
    ? tarifa.precoAssento * assentos + tarifa.precoAssentoBagagem * avaliacao.assentosEquivalentes
    : 0;

  const entradaReserva = () => ({
    rotaId: selecionada as string,
    dataViagem: data,
    assentos,
    assentosBagagem: avaliacao.assentosEquivalentes,
    exclusiva,
    bagagemKg: Number(avaliacao.pesoKg.toFixed(1)),
    ...(enderecoValido ? { enderecoEmbarque: enderecoDebounced } : {}),
    environment: "live" as const,
  });

  const previa = useQuery({
    queryKey: [
      "previa-reserva",
      selecionada,
      data,
      assentos,
      avaliacao.assentosEquivalentes,
      exclusiva,
      avaliacao.pesoKg,
      enderecoValido ? enderecoDebounced : "",
    ],
    enabled: Boolean(selecionada),
    queryFn: async () => {
      const r = await previaDaReserva({ data: entradaReserva() });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
  });


  const qc = useQueryClient();
  const preReservar = useServerFn(criarPreReserva);
  const [preReservando, setPreReservando] = useState(false);

  /** Pré-reserva sem pagamento: o valor é fechado 60 min antes da partida. */
  const enviarPreReserva = async () => {
    if (!selecionada) return;
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      toast.info("Entre na sua conta para pré-reservar.");
      void navigate({ to: "/auth" });
      return;
    }
    setPreReservando(true);
    try {
      const r = await preReservar({
        data: {
          rotaId: selecionada,
          dataViagem: data,
          assentos,
          assentosBagagem: avaliacao.assentosEquivalentes,
          endereco: enderecoDebounced,
          exclusiva,
          bagagemKg: Number(avaliacao.pesoKg.toFixed(1)),
        },
      });
      if ("error" in r) throw new Error(r.error);
      toast.success(
        `Pré-reserva registrada para ${r.endereco}. O valor final chega ${ANTECEDENCIA_FECHAMENTO_MIN} minutos antes da saída.`,
      );
      void qc.invalidateQueries({ queryKey: ["minhas-pre-reservas"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível pré-reservar.");
    } finally {
      setPreReservando(false);
    }
  };


  const pagarComCreditos = async (avisarFalta = true) => {
    if (!selecionada) return false;
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      toast.info("Entre na sua conta para garantir o assento.");
      void navigate({ to: "/auth" });
      return false;
    }

    setPagando(true);
    try {
      const r = await pagarReservaComCreditos({ data: entradaReserva() });
      if ("error" in r) throw new Error(r.error);
      if (r.status === "lotado") {
        toast.error(
          r.disponiveis > 0
            ? `Restam apenas ${r.disponiveis} assento(s) nesta saída.`
            : "Esta saída já está com a lotação completa.",
        );
        return false;
      }
      if (r.status === "sem_saldo") {
        if (avisarFalta) {
          toast.info(
            `Faltam ${brl(r.faltando)} em créditos. Complete o pagamento via Pix para garantir o assento.`,
          );
          setPixPrice(r.pacoteSugerido);
        }
        return false;
      }
      toast.success(
        `Assento garantido! Pagamos ${brl(r.total)} com seus créditos (saldo restante ${brl(
          r.saldoRestante,
        )}).`,
      );
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a reserva.");
      return false;
    } finally {
      setPagando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-bold">Reserve seu lugar na próxima saída</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Origem, destino, dia e horário. O assento só é confirmado com o pagamento antecipado.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {/* Busca */}
            <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Origem
                  </span>
                  <select
                    className={campo}
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                  >
                    <option value="">Qualquer origem</option>
                    {localidades.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Destino
                  </span>
                  <select
                    className={campo}
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                  >
                    <option value="">Qualquer destino</option>
                    {localidades.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Data da viagem
                  </span>
                  <input
                    type="date"
                    className={campo}
                    min={hoje}
                    value={data}
                    onChange={(e) => setData(e.target.value < hoje ? hoje : e.target.value)}
                  />

                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    Assentos
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    className={campo}
                    value={assentos}
                    onChange={(e) => setAssentos(Math.max(1, Number(e.target.value)))}
                  />
                </label>
              </div>
            </div>

            {/* Resultados */}
            <h2 data-tour="busca-rotas" className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {rotas.isLoading ? "Buscando saídas…" : `${resultados.length} saída(s) encontrada(s)`}
            </h2>
            <div className="mt-4 space-y-3">
              {resultados.map((v) => {
                const ativa = selecionada === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelecionada(v.id)}
                    className={`w-full rounded-2xl border p-5 text-left transition-all ${
                      ativa
                        ? "border-accent bg-accent/10"
                        : "border-border bg-card hover:border-foreground/25"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 font-display text-lg font-bold">
                          {hora(v.saida_ida)}
                          <ArrowRight className="size-4 text-muted-foreground" />
                          {hora(v.chegada_ida)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {v.origem}/{v.uf_origem ?? "AP"} → {v.destino}/{v.uf_destino ?? "AP"} ·{" "}
                          {Number(v.distancia_km)} km

                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {v.assentos} assento(s)
                          </span>
                          {v.saida_retorno && <span>retorno {hora(v.saida_retorno)}</span>}
                          {v.travessias > 0 && <span>{v.travessias} travessia(s)</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-bold">
                          {brl(Number(v.preco_assento))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">por assento</p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!rotas.isLoading && resultados.length === 0 && (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {ehHoje
                    ? "Os embarques de hoje já saíram. Escolha uma data futura — as rotas seguem ofertadas todos os dias."
                    : "Nenhuma saída cadastrada para esse trecho ainda."}

                </p>
              )}
            </div>
          </div>

          {/* Painel lateral */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Luggage className="size-4 text-accent" /> Calculadora de bagagem
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(
                  [
                    ["comprimentoCm", "Compr. cm"],
                    ["larguraCm", "Larg. cm"],
                    ["alturaCm", "Alt. cm"],
                    ["pesoKg", "Peso kg"],
                    ["quantidade", "Qtde"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
                    <input
                      type="number"
                      min={1}
                      className={campo}
                      value={bag[k]}
                      onChange={(e) => setBag({ ...bag, [k]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Volume calculado</span>
                  <strong>{avaliacao.volumeL.toFixed(0)} L</strong>
                </p>
                <p className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Peso total</span>
                  <strong>{avaliacao.pesoKg.toFixed(1)} kg</strong>
                </p>
                <p className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Ocupação do bagageiro</span>
                  <strong>{(avaliacao.ocupacaoBagageiro * 100).toFixed(0)}%</strong>
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  V = Σ(c·l·a/1000)·q ÷ 0,82 — franquia de mão: 45 L e 10 kg por assento.
                </p>
              </div>

              <p
                className={`mt-3 rounded-xl p-3 text-xs leading-relaxed ${
                  avaliacao.excedeVeiculo
                    ? "bg-destructive/10 text-destructive"
                    : avaliacao.assentosEquivalentes > 0
                      ? "bg-accent/15 text-accent-foreground"
                      : "bg-success/10 text-success"
                }`}
              >
                {avaliacao.mensagem}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Recomendação da IA: {rotuloClasse(avaliacao.recomendacao)}.
              </p>
            </div>

            <div data-tour="reserva" className="rounded-3xl border border-border surface-night p-5 text-primary-foreground shadow-[var(--shadow-lift)]">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Wallet className="size-4 text-accent" /> Reserva
              </h2>
              {viagem && tarifa ? (
                <>
                  <p className="mt-3 text-xs text-primary-foreground/70">
                    {viagem.origem} → {viagem.destino}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-primary-foreground/70">
                    <Clock className="size-3" /> {data} · saída {hora(viagem.saida_ida)} · chegada{" "}
                    {hora(viagem.chegada_ida)}
                  </p>

                  <label className="mt-4 block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground/70">
                      <MapPin className="size-3 text-accent" /> Onde será o seu embarque?
                    </span>
                    <input
                      className="w-full rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-2.5 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/40 focus:ring-2 focus:ring-accent"
                      placeholder="Rua, número e bairro"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                    />
                    <span className="mt-1 block text-[11px] text-primary-foreground/55">
                      {enderecoValido
                        ? previa.isFetching
                          ? "Calculando o desvio até o seu ponto…"
                          : (previa.data?.desvio?.endereco ??
                            "Sem desvio adicional para este ponto.")
                        : "Informe o ponto de apanhe para calcular o desvio imediatamente."}
                    </span>
                  </label>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
                    <input
                      type="checkbox"
                      checked={exclusiva}
                      onChange={(e) => setExclusiva(e.target.checked)}
                      className="mt-0.5 size-4 accent-current"
                    />
                    <span className="text-[11px] leading-relaxed text-primary-foreground/80">
                      <strong className="block text-xs text-primary-foreground">
                        Quero esta saída com exclusividade
                      </strong>
                      Tarifa integral do veículo ({viagem.assentos} assentos), sem dividir com outros
                      passageiros. Bagagem liberada até {FRANQUIA_EXCLUSIVA_KG} kg — acima disso,
                      cobramos {brl(PRECO_KG_EXCEDENTE)} por quilo excedente.
                    </span>
                  </label>

                  <dl className="mt-4 space-y-1.5 text-sm">
                    {exclusiva ? (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-primary-foreground/70">
                            Exclusividade · tarifa integral ({viagem.assentos} assentos)
                          </dt>
                          <dd>{brl(tarifa.precoAssento * viagem.assentos)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-primary-foreground/70">
                            Peso excedente ({previa.data?.excedenteKg ?? pesoExcedenteKg(avaliacao.pesoKg)} kg
                            acima de {FRANQUIA_EXCLUSIVA_KG} kg)
                          </dt>
                          <dd>
                            {brl(previa.data?.valorPesoExcedente ?? custoPesoExcedente(avaliacao.pesoKg))}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-primary-foreground/70">{assentos} assento(s)</dt>
                          <dd>{brl(tarifa.precoAssento * assentos)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-primary-foreground/70">
                            Bagagem excedente ({avaliacao.assentosEquivalentes})
                          </dt>
                          <dd>{brl(tarifa.precoAssentoBagagem * avaliacao.assentosEquivalentes)}</dd>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-primary-foreground/70">
                        Desvio do embarque
                        {previa.data?.desvio
                          ? ` (+${previa.data.desvio.kmExtra} km · +${previa.data.desvio.minutosExtra} min)`
                          : ""}
                      </dt>
                      <dd>
                        {enderecoValido
                          ? previa.isFetching
                            ? "calculando…"
                            : brl(previa.data?.desvio?.taxa ?? 0)
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-primary-foreground/15 pt-2">
                      <dt className="text-primary-foreground/70">Subtotal da corrida</dt>
                      <dd>{brl(previa.data?.base ?? total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-primary-foreground/70">Taxa administrativa</dt>
                      <dd>{previa.data ? brl(previa.data.taxaAdministrativa) : "calculando…"}</dd>
                    </div>
                    <div className="flex justify-between border-t border-primary-foreground/15 pt-2 font-display text-lg font-bold">
                      <dt>Total</dt>
                      <dd className="text-accent">{brl(previa.data?.total ?? total)}</dd>
                    </div>
                  </dl>
                  {previa.error && (
                    <p className="mt-2 rounded-xl bg-destructive/20 p-3 text-[11px] text-primary-foreground">
                      {(previa.error as Error).message}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-primary-foreground/55">
                    A taxa administrativa custeia gateway de pagamento, telefonia/SMS, hospedagem,
                    consultas de idoneidade e o registro do trajeto em cadeia de blocos.
                  </p>
                  <button
                    onClick={() => void pagarComCreditos()}
                    disabled={pagando || !enderecoValido || previa.isFetching || !previa.data}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {pagando && <Loader2 className="size-4 animate-spin" />}
                    Pagar e garantir a lotação
                  </button>
                  <button
                    onClick={() => setPixCorrida(true)}
                    disabled={!enderecoValido || previa.isFetching || !previa.data}
                    className="mt-2 w-full rounded-full border border-primary-foreground/25 px-5 py-2.5 text-xs font-semibold text-primary-foreground/85 hover:bg-primary-foreground/10 disabled:opacity-60"
                  >
                    Pagar esta corrida no Pix (sem carteira)
                  </button>

                  {exclusiva ? (
                    <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-3">
                      <p className="text-xs font-semibold">
                        Exclusividade: pagamento imediato, sem agendamento
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-primary-foreground/70">
                        Como a saída fica exclusiva para você, não há pré-reserva nem preço dinâmico
                        no fechamento: a tarifa integral do veículo já está calculada acima e o
                        assento só é bloqueado com o pagamento confirmado agora.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-primary-foreground/20 bg-primary-foreground/5 p-3">
                      <p className="text-xs font-semibold">
                        Preço dinâmico: pré-reserve e pague só no fechamento
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-primary-foreground/70">
                        {ANTECEDENCIA_FECHAMENTO_MIN} minutos antes da saída fechamos a rota e
                        calculamos o valor conforme os assentos reservados e o desvio até o seu
                        embarque. Estimativa para {assentos} assento(s):{" "}
                        {brl(faixaEstimada(tarifa.precoAssento, assentos).minimo)} a{" "}
                        {brl(faixaEstimada(tarifa.precoAssento, assentos).maximo)} + taxa. Avisamos
                        por app, SMS, WhatsApp e e-mail; a confirmação é pelo pagamento.
                      </p>
                      <button
                        onClick={() => void enviarPreReserva()}
                        disabled={preReservando || !enderecoValido}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary-foreground/15 px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/25 disabled:opacity-60"
                      >
                        {preReservando && <Loader2 className="size-4 animate-spin" />}
                        Pré-reservar (valor fechado 60 min antes)
                      </button>
                    </div>
                  )}


                  <p className="mt-3 text-[11px] leading-relaxed text-primary-foreground/55">
                    Você pode pagar com os créditos da carteira ou gerar um Pix avulso pelo valor
                    exato desta corrida, sem precisar de saldo. O assento é garantido logo após a
                    confirmação. Em caso de pane, folga ou força maior registrada pelo motorista, o
                    valor é devolvido integralmente.
                  </p>


                </>
              ) : (
                <p className="mt-3 text-xs text-primary-foreground/60">
                  Selecione uma saída na lista para ver o valor da reserva.
                </p>
              )}
            </div>
          </aside>
        </div>

        <PreReservas />

        <section className="mt-14 border-t border-border pt-10">

          <h2 className="font-display text-2xl font-bold">Modo urbano</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Precisa de uma corrida dentro da cidade, distritos ou vilarejos? Veja o preço antes de
            pedir e escolha entre corrida imediata ou agendada.
          </p>
          <div className="mt-6">
            <PedirCorridaUrbana />
          </div>
        </section>
      </main>


      {pixPrice && (
        <CheckoutPix
          priceId={pixPrice}
          onFechar={() => setPixPrice(null)}
          onAprovado={() => {
            setPixPrice(null);
            void pagarComCreditos(false).then((ok) => {
              if (!ok)
                toast.info(
                  "Créditos adicionados. Toque em “Pagar e garantir a lotação” para concluir.",
                );
            });
          }}
        />
      )}

      {pixCorrida && selecionada && (
        <CheckoutPix
          titulo="Pagar esta corrida no Pix"
          carregarPrevia={async () => {
            const r = await previaDaReserva({ data: entradaReserva() });
            if ("error" in r) throw new Error(r.error);
            return {
              base: r.base,
              taxaPercentual: 0,
              taxaFixa: 0,
              taxaAdmin: r.taxaAdministrativa,
              total: r.total,
              creditos: r.total,
              descricao: `Corrida ${r.origem} → ${r.destino} em ${data}`,
            };
          }}
          gerarPix={async (cpf) => {
            const r = await gerarPixDaCorrida({
              data: { ...entradaReserva(), ...(cpf ? { cpf } : {}) },
            });
            if ("error" in r) throw new Error(r.error);
            return r as never;
          }}
          onFechar={() => setPixCorrida(false)}
          onAprovado={() => {
            setPixCorrida(false);
            void pagarComCreditos(false).then((ok) => {
              if (!ok)
                toast.info(
                  "Pix confirmado. Toque em “Pagar e garantir a lotação” para concluir a reserva.",
                );
            });
          }}
        />
      )}
    </div>
  );
}
