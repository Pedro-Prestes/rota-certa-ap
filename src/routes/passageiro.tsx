import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Luggage,
  Star,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL, frota, localidadesAP, viagens } from "@/lib/dados";
import {
  avaliarBagagem,
  brl,
  calcularTarifa,
  rotuloClasse,
  type Volume,
} from "@/lib/logistica";

export const Route = createFileRoute("/passageiro")({
  head: () => ({
    meta: [
      { title: "Reservar assento e bagagem | RotaViva Amapá" },
      {
        name: "description",
        content:
          "Busque rotas entre sedes, distritos e vilarejos do Amapá, calcule o volume da sua bagagem e garanta o assento com pagamento antecipado.",
      },
      { property: "og:title", content: "Reservar assento e bagagem | RotaViva" },
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

function Passageiro() {
  const [origem, setOrigem] = useState("Macapá (sede)");
  const [destino, setDestino] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [assentos, setAssentos] = useState(1);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const [bag, setBag] = useState<Volume>({
    comprimentoCm: 55,
    larguraCm: 35,
    alturaCm: 25,
    pesoKg: 8,
    quantidade: 1,
  });

  const resultados = useMemo(
    () =>
      viagens.filter(
        (v) =>
          (!origem || v.origem === origem) &&
          (!destino || v.destino === destino),
      ),
    [origem, destino],
  );

  const viagem = viagens.find((v) => v.id === selecionada) ?? null;
  const veiculo = viagem ? frota.find((f) => f.id === viagem.veiculoId)! : frota[2]!;

  const avaliacao = useMemo(() => avaliarBagagem([bag], veiculo), [bag, veiculo]);

  const tarifa = useMemo(
    () =>
      viagem
        ? calcularTarifa({
            distanciaKm: viagem.distanciaKm,
            dificuldadeVia: viagem.dificuldadeVia,
            precoCombustivel: PRECO_COMBUSTIVEL,
            consumoKmL: CONSUMO_KM_L,
            assentos: veiculo.assentos,
            ocupacaoMedia: 0.78,
            travessias: viagem.travessias,
          })
        : null,
    [viagem, veiculo],
  );

  const total = tarifa
    ? tarifa.precoAssento * assentos + tarifa.precoAssentoBagagem * avaliacao.assentosEquivalentes
    : 0;

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
                  <select className={campo} value={origem} onChange={(e) => setOrigem(e.target.value)}>
                    <option value="">Qualquer origem</option>
                    {localidadesAP.map((l) => (
                      <option key={l.nome}>{l.nome}</option>
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
                    {localidadesAP.map((l) => (
                      <option key={l.nome}>{l.nome}</option>
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
              {resultados.length} saída(s) encontrada(s)
            </h2>
            <div className="mt-4 space-y-3">
              {resultados.map((v) => {
                const veic = frota.find((f) => f.id === v.veiculoId)!;
                const t = calcularTarifa({
                  distanciaKm: v.distanciaKm,
                  dificuldadeVia: v.dificuldadeVia,
                  precoCombustivel: PRECO_COMBUSTIVEL,
                  consumoKmL: CONSUMO_KM_L,
                  assentos: veic.assentos,
                  ocupacaoMedia: 0.78,
                  travessias: v.travessias,
                });
                const ativa = selecionada === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelecionada(v.id)}
                    disabled={v.status === "suspensa"}
                    className={`w-full rounded-2xl border p-5 text-left transition-all ${
                      ativa ? "border-accent bg-accent/10" : "border-border bg-card hover:border-foreground/25"
                    } ${v.status === "suspensa" ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 font-display text-lg font-bold">
                          {v.partida}
                          <ArrowRight className="size-4 text-muted-foreground" />
                          {v.chegada}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {v.origem} → {v.destino} · {v.distanciaKm} km
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Star className="size-3 fill-accent text-accent" />
                            {v.nota.toFixed(1)} · {v.motorista}
                          </span>
                          <span className="flex items-center gap-1">
                            {v.classe === "passageiro" ? (
                              <Users className="size-3" />
                            ) : (
                              <Truck className="size-3" />
                            )}
                            {veic.modelo}
                          </span>
                          <span>{v.assentosLivres} vaga(s)</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-bold">{brl(t.precoAssento)}</p>
                        <p className="text-[11px] text-muted-foreground">por assento</p>
                      </div>
                    </div>
                    {v.status === "suspensa" && (
                      <p className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {v.aviso}
                      </p>
                    )}
                  </button>
                );
              })}
              {resultados.length === 0 && (
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
                    <Clock className="size-3" /> {data} · saída {viagem.partida} · chegada{" "}
                    {viagem.chegada}
                  </p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-primary-foreground/70">
                        {assentos} assento(s)
                      </dt>
                      <dd>{brl(tarifa.precoAssento * assentos)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-primary-foreground/70">
                        Bagagem excedente ({avaliacao.assentosEquivalentes})
                      </dt>
                      <dd>{brl(tarifa.precoAssentoBagagem * avaliacao.assentosEquivalentes)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-primary-foreground/15 pt-2 font-display text-lg font-bold">
                      <dt>Total</dt>
                      <dd className="text-accent">{brl(total)}</dd>
                    </div>
                  </dl>
                  <button className="mt-5 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5">
                    Pagar e garantir a lotação
                  </button>
                  <p className="mt-3 text-[11px] leading-relaxed text-primary-foreground/55">
                    Pagamento antecipado obrigatório. Em caso de pane, folga ou força maior
                    registrada pelo motorista, o valor é devolvido integralmente.
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
    </div>
  );
}
