import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Clock, Loader2, Luggage, Users, Wallet } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CheckoutPix } from "@/components/CheckoutPix";
import { supabase } from "@/integrations/supabase/client";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL, frota, localidadesAP } from "@/lib/dados";
import {
  gerarPixDaCorrida,
  pagarReservaComCreditos,
  previaDaReserva,
} from "@/utils/reserva.functions";

import { avaliarBagagem, brl, calcularTarifa, rotuloClasse, type Volume } from "@/lib/logistica";

type RotaPublica = {
  id: string;
  origem: string;
  destino: string;
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
      { title: "Reservar assento e bagagem | RotaCerta Amapá" },
      {
        name: "description",
        content:
          "Busque rotas entre sedes, distritos e vilarejos do Amapá, calcule o volume da sua bagagem e garanta o assento com pagamento antecipado.",
      },
      { property: "og:title", content: "Reservar assento e bagagem | RotaCerta" },
      {
        property: "og:description",
        content: "Agenda de rotas, cálculo de bagagem por IA e reserva de lotação paga antes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Passageiro,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

const hora = (v: string | null) => (v ? v.slice(0, 5) : "--:--");

function Passageiro() {
  const [origem, setOrigem] = useState("Macapá (sede)");
  const [destino, setDestino] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [assentos, setAssentos] = useState(1);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [pixPrice, setPixPrice] = useState<string | null>(null);
  const [pixCorrida, setPixCorrida] = useState(false);
  const navigate = useNavigate();

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
          "id, origem, destino, saida_ida, chegada_ida, saida_retorno, distancia_km, assentos, travessias, dificuldade_via, preco_assento",
        )
        .eq("status", "ativa")
        .order("saida_ida", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RotaPublica[];
    },
  });

  const todas = rotas.data ?? [];

  const localidades = useMemo(() => {
    const nomes = new Set<string>(localidadesAP.map((l) => l.nome));
    for (const r of todas) {
      nomes.add(r.origem);
      nomes.add(r.destino);
    }
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [todas]);

  const resultados = useMemo(
    () =>
      todas.filter((r) => (!origem || r.origem === origem) && (!destino || r.destino === destino)),
    [todas, origem, destino],
  );

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
    environment: "live" as const,
  });

  const previa = useQuery({
    queryKey: ["previa-reserva", selecionada, data, assentos, avaliacao.assentosEquivalentes],
    enabled: Boolean(selecionada),
    queryFn: async () => {
      const r = await previaDaReserva({ data: entradaReserva() });
      if ("error" in r) return null;
      return r;
    },
  });


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
                    value={data}
                    onChange={(e) => setData(e.target.value)}
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
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
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
                          {v.origem} → {v.destino} · {Number(v.distancia_km)} km
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
                  Nenhuma saída cadastrada para esse trecho ainda.
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

            <div className="rounded-3xl border border-border surface-night p-5 text-primary-foreground shadow-[var(--shadow-lift)]">
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
                  <dl className="mt-4 space-y-1.5 text-sm">
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
                    <div className="flex justify-between border-t border-primary-foreground/15 pt-2">
                      <dt className="text-primary-foreground/70">Subtotal da corrida</dt>
                      <dd>{brl(previa.data?.base ?? total)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-primary-foreground/70">Taxa administrativa</dt>
                      <dd>
                        {previa.data ? brl(previa.data.taxaAdministrativa) : "calculando…"}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-primary-foreground/15 pt-2 font-display text-lg font-bold">
                      <dt>Total</dt>
                      <dd className="text-accent">{brl(previa.data?.total ?? total)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-primary-foreground/55">
                    A taxa administrativa custeia gateway de pagamento, telefonia/SMS, hospedagem,
                    consultas de idoneidade e o registro do trajeto em cadeia de blocos.
                  </p>
                  <button
                    onClick={() => void pagarComCreditos()}
                    disabled={pagando}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {pagando && <Loader2 className="size-4 animate-spin" />}
                    Pagar e garantir a lotação
                  </button>
                  <button
                    onClick={() => setPixCorrida(true)}
                    className="mt-2 w-full rounded-full border border-primary-foreground/25 px-5 py-2.5 text-xs font-semibold text-primary-foreground/85 hover:bg-primary-foreground/10"
                  >
                    Pagar esta corrida no Pix (sem carteira)
                  </button>
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
