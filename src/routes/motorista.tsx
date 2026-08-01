import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Brain, Car, CheckCircle2, Plus, Route as RouteIcon } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL, frota, localidadesAP, viagens } from "@/lib/dados";
import { anoMinimoPermitido, brl, calcularTarifa, veiculoElegivel } from "@/lib/logistica";

export const Route = createFileRoute("/motorista")({
  head: () => ({
    meta: [
      { title: "Painel do motorista | RotaViva Amapá" },
      {
        name: "description",
        content:
          "Cadastre veículo e rotas entre sedes, distritos e vilarejos, defina horários de ida e retorno, avise panes e receba a tarifa sugerida pela IA.",
      },
      { property: "og:title", content: "Painel do motorista | RotaViva" },
      {
        property: "og:description",
        content: "Cadastro de frota, rotas com horários e aviso de indisponibilidade aos passageiros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Motorista,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

function Motorista() {
  const [aba, setAba] = useState<"rotas" | "veiculo" | "avisos">("rotas");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-bold">Painel do motorista</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Publique suas saídas, mantenha a frota regular e avise seus passageiros quando não puder
          rodar.
        </p>

        <div className="mt-7 inline-flex rounded-full border border-border bg-card p-1">
          {(
            [
              ["rotas", "Rotas e horários", RouteIcon],
              ["veiculo", "Veículo", Car],
              ["avisos", "Indisponibilidade", AlertTriangle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                aba === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {aba === "rotas" && <AbaRotas />}
          {aba === "veiculo" && <AbaVeiculo />}
          {aba === "avisos" && <AbaAvisos />}
        </div>
      </main>
    </div>
  );
}

function AbaRotas() {
  const [distancia, setDistancia] = useState(120);
  const [dificuldade, setDificuldade] = useState(0.5);
  const [travessias, setTravessias] = useState(1);
  const [assentos, setAssentos] = useState(6);

  const tarifa = useMemo(
    () =>
      calcularTarifa({
        distanciaKm: distancia,
        dificuldadeVia: dificuldade,
        precoCombustivel: PRECO_COMBUSTIVEL,
        consumoKmL: CONSUMO_KM_L,
        assentos,
        ocupacaoMedia: 0.78,
        travessias,
      }),
    [distancia, dificuldade, travessias, assentos],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Cadastrar rota</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sede, distrito ou vilarejo — informe também o trecho de retorno.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={rotulo}>Ponto de origem</span>
            <select className={campo} defaultValue="Macapá (sede)">
              {localidadesAP.map((l) => (
                <option key={l.nome}>
                  {l.nome} · {l.tipo}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={rotulo}>Ponto de destino</span>
            <select className={campo} defaultValue="Mazagão Velho">
              {localidadesAP.map((l) => (
                <option key={l.nome}>
                  {l.nome} · {l.tipo}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={rotulo}>Saída (ida)</span>
            <input type="time" className={campo} defaultValue="06:15" />
          </label>
          <label>
            <span className={rotulo}>Chegada (ida)</span>
            <input type="time" className={campo} defaultValue="08:10" />
          </label>
          <label>
            <span className={rotulo}>Saída (retorno)</span>
            <input type="time" className={campo} defaultValue="16:00" />
          </label>
          <label>
            <span className={rotulo}>Chegada (retorno)</span>
            <input type="time" className={campo} defaultValue="18:05" />
          </label>
          <label>
            <span className={rotulo}>Distância (km)</span>
            <input
              type="number"
              className={campo}
              value={distancia}
              onChange={(e) => setDistancia(Number(e.target.value))}
            />
          </label>
          <label>
            <span className={rotulo}>Assentos ofertados</span>
            <input
              type="number"
              className={campo}
              value={assentos}
              onChange={(e) => setAssentos(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <label>
            <span className={rotulo}>Travessias de balsa / pedágios</span>
            <input
              type="number"
              min={0}
              className={campo}
              value={travessias}
              onChange={(e) => setTravessias(Number(e.target.value))}
            />
          </label>
          <label>
            <span className={rotulo}>
              Dificuldade da via: {(dificuldade * 100).toFixed(0)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="mt-3 w-full accent-[var(--accent)]"
              value={dificuldade}
              onChange={(e) => setDificuldade(Number(e.target.value))}
            />
          </label>
        </div>

        <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" /> Publicar rota
        </button>

        <h3 className="mt-10 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Minhas saídas publicadas
        </h3>
        <ul className="mt-4 divide-y divide-border">
          {viagens.slice(0, 4).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {v.origem} → {v.destino}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.partida} – {v.chegada} · {v.assentosLivres} vaga(s)
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  v.status === "ativa"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {v.status === "ativa" ? "Ativa" : "Suspensa"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <aside className="rounded-3xl border border-border surface-night p-6 text-primary-foreground shadow-[var(--shadow-lift)] lg:sticky lg:top-24 lg:self-start">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Brain className="size-4 text-accent" /> Tarifa sugerida pela IA
        </h2>
        <p className="mt-4 font-display text-3xl font-bold text-accent">
          {brl(tarifa.precoAssento)}
        </p>
        <p className="text-xs text-primary-foreground/60">por assento</p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Custo operacional</dt>
            <dd>{brl(tarifa.custoOperacional)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Faixa aceitável</dt>
            <dd>
              {brl(tarifa.faixaMin)} – {brl(tarifa.faixaMax)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Assento de bagagem</dt>
            <dd>{brl(tarifa.precoAssentoBagagem)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-primary-foreground/55">
          {tarifa.detalhe}. A calibração usa os dados dos motoristas já cadastrados na região e é
          reajustada conforme ocupação real, preço do combustível e condição das vias.
        </p>
      </aside>
    </div>
  );
}

function AbaVeiculo() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual - 4);
  const elegivel = veiculoElegivel(ano, anoAtual);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Cadastrar veículo</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={rotulo}>Modelo</span>
            <input className={campo} placeholder="Ex.: Chevrolet Spin 1.8" />
          </label>
          <label>
            <span className={rotulo}>Ano de fabricação</span>
            <input
              type="number"
              className={campo}
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            />
          </label>
          <label>
            <span className={rotulo}>Classe</span>
            <select className={campo}>
              <option>Veículo de passageiros</option>
              <option>Utilitário de pequeno porte</option>
              <option>Utilitário de médio porte</option>
              <option>Utilitário de grande porte</option>
            </select>
          </label>
          <label>
            <span className={rotulo}>Assentos</span>
            <input type="number" className={campo} defaultValue={6} />
          </label>
          <label>
            <span className={rotulo}>Bagageiro (litros)</span>
            <input type="number" className={campo} defaultValue={380} />
          </label>
          <label>
            <span className={rotulo}>Carga útil (kg)</span>
            <input type="number" className={campo} defaultValue={420} />
          </label>
        </div>

        <p
          className={`mt-5 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed ${
            elegivel ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {elegivel ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          {elegivel
            ? `Veículo elegível: ano ${ano} está dentro do limite de 10 anos (mínimo ${anoMinimoPermitido(anoAtual)}).`
            : `Veículo recusado: só são aceitos modelos ${anoMinimoPermitido(anoAtual)} ou mais novos em ${anoAtual}.`}
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Frota cadastrada</h2>
        <ul className="mt-4 space-y-3">
          {frota.map((v) => (
            <li key={v.id} className="rounded-2xl border border-border p-4 text-sm">
              <p className="font-semibold">{v.modelo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {v.assentos} assentos · bagageiro {v.volumeBagageiroL} L · carga útil{" "}
                {v.cargaUtilKg} kg
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AbaAvisos() {
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Registrar indisponibilidade</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Todos os passageiros com reserva na rota recebem a notificação e o reembolso integral.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className={rotulo}>Motivo</span>
            <select className={campo}>
              <option>Pane mecânica do veículo</option>
              <option>Folga programada</option>
              <option>Condição da via / alagamento</option>
              <option>Motivo de saúde</option>
              <option>Outro motivo de força maior</option>
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Rota afetada</span>
            <select className={campo}>
              {viagens.map((v) => (
                <option key={v.id}>
                  {v.origem} → {v.destino} ({v.partida})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={rotulo}>Início</span>
              <input type="date" className={campo} />
            </label>
            <label>
              <span className={rotulo}>Retorno previsto</span>
              <input type="date" className={campo} />
            </label>
          </div>
          <label className="block">
            <span className={rotulo}>Mensagem aos passageiros</span>
            <textarea
              className={`${campo} min-h-24`}
              defaultValue="Veículo em manutenção. Retorno previsto para amanhã às 07:00."
            />
          </label>
        </div>
        <button
          onClick={() => setEnviado(true)}
          className="mt-5 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground"
        >
          Suspender rota e avisar passageiros
        </button>
        {enviado && (
          <p className="mt-3 text-xs text-success">
            Aviso publicado. Passageiros notificados e reembolsos disparados.
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Avisos ativos na região</h2>
        <ul className="mt-4 space-y-3">
          {viagens
            .filter((v) => v.status === "suspensa")
            .map((v) => (
              <li key={v.id} className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold">
                  {v.origem} → {v.destino}
                </p>
                <p className="mt-1 text-xs">{v.aviso}</p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
