import { useEffect, useMemo, useState } from "react";
import { Navigation, PhoneCall, Play, Timer, UserCheck } from "lucide-react";
import { horaLocal } from "@/lib/embarque";

export interface ParadaNavegacao {
  id: string;
  passageiro_nome: string;
  telefone: string | null;
  endereco: string;
  referencia: string | null;
  assentos: number;
  latitude: number;
  longitude: number;
  ordem: number | null;
  eta_ponto: string | null;
}

const gps = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;

const gpsCompleto = (paradas: ParadaNavegacao[]) => {
  const pontos = paradas.map((p) => `${p.latitude},${p.longitude}`);
  const destino = pontos[pontos.length - 1]!;
  const meio = pontos.slice(0, -1);
  const waypoints = meio.length ? `&waypoints=${meio.join("|")}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}${waypoints}&travelmode=driving&dir_action=navigate`;
};

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Condução por GPS da rota de busca: o motorista navega ponto a ponto, vê o
 * nome do passageiro, liga se precisar, aguarda o tempo de embarque com
 * cronômetro e confirma o embarque antes de seguir para o próximo ponto.
 */
export function NavegacaoEmbarque({ paradas }: { paradas: ParadaNavegacao[] }) {
  const ordenadas = useMemo(
    () => [...paradas].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99)),
    [paradas],
  );
  const [embarcados, setEmbarcados] = useState<string[]>([]);
  const [aguardando, setAguardando] = useState<{ id: string; segundos: number } | null>(null);

  const atual = ordenadas.find((p) => !embarcados.includes(p.id)) ?? null;

  useEffect(() => {
    if (!aguardando) return;
    const t = setInterval(
      () => setAguardando((a) => (a ? { ...a, segundos: a.segundos + 1 } : a)),
      1000,
    );
    return () => clearInterval(t);
  }, [aguardando?.id]);

  if (ordenadas.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <Navigation className="size-4 text-accent" /> Condução por GPS
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {embarcados.length} de {ordenadas.length} passageiros embarcados.
          </p>
        </div>
        <a
          href={gpsCompleto(ordenadas)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
        >
          <Play className="size-3" /> Navegar por todos os pontos
        </a>
      </header>

      <ol className="mt-4 space-y-3">
        {ordenadas.map((p, i) => {
          const feito = embarcados.includes(p.id);
          const ehAtual = atual?.id === p.id;
          return (
            <li
              key={p.id}
              className={`rounded-2xl border p-4 ${
                ehAtual ? "border-accent bg-accent/5" : "border-border"
              } ${feito ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold">
                    {i + 1}º · {p.passageiro_nome}
                    {feito ? " — embarcado" : ehAtual ? " — próximo ponto" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.endereco}
                    {p.referencia ? ` — ${p.referencia}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.assentos} assento(s) · chegada prevista {horaLocal(p.eta_ponto)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={gps(p.latitude, p.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold"
                  >
                    <Navigation className="size-3" /> Ir até o ponto
                  </a>
                  {p.telefone && (
                    <a
                      href={`tel:${p.telefone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold"
                    >
                      <PhoneCall className="size-3" /> Ligar
                    </a>
                  )}
                </div>
              </div>

              {ehAtual && !feito && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {aguardando?.id === p.id ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold">
                      <Timer className="size-3" /> Aguardando o passageiro ·{" "}
                      {mmss(aguardando.segundos)}
                    </span>
                  ) : (
                    <button
                      onClick={() => setAguardando({ id: p.id, segundos: 0 })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold"
                    >
                      <Timer className="size-3" /> Cheguei — aguardar embarque
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEmbarcados((e) => [...e, p.id]);
                      setAguardando(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-semibold text-accent-foreground"
                  >
                    <UserCheck className="size-3" /> Passageiro embarcou
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {embarcados.length === ordenadas.length && (
        <p className="mt-4 rounded-2xl bg-success/10 p-3 text-center text-xs font-semibold text-success">
          Todos embarcados — siga para a saída da cidade e inicie a viagem programada.
        </p>
      )}
    </section>
  );
}
