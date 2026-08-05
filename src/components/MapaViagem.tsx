import { useMemo } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { ROTULO_SINAL, estadoDoSinal, horaLocal, type Posicao } from "@/lib/rastreio";

/**
 * Mapa do trajeto transmitido. O traçado é desenhado localmente (projeção
 * equiretangular normalizada), de modo que o acompanhamento continua
 * funcionando mesmo quando o provedor de mapas está indisponível.
 */
export function MapaViagem({
  posicoes,
  pontos = [],
  altura = 260,
}: {
  posicoes: Posicao[];
  pontos?: Array<{ rotulo: string; latitude: number; longitude: number }>;
  altura?: number;
}) {
  const atual = posicoes[posicoes.length - 1];
  const sinal = estadoDoSinal(atual?.registrado_em);

  const traco = useMemo(() => {
    const todos = [
      ...posicoes.map((p) => ({ x: p.longitude, y: p.latitude })),
      ...pontos.map((p) => ({ x: p.longitude, y: p.latitude })),
    ];
    if (todos.length === 0) return null;
    const xs = todos.map((p) => p.x);
    const ys = todos.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(1e-4, maxX - minX);
    const spanY = Math.max(1e-4, maxY - minY);
    const proj = (lat: number, lon: number) => ({
      x: 6 + ((lon - minX) / spanX) * 88,
      y: 94 - ((lat - minY) / spanY) * 88,
    });
    return {
      linha: posicoes.map((p) => proj(p.latitude, p.longitude)),
      marcos: pontos.map((p) => ({ ...proj(p.latitude, p.longitude), rotulo: p.rotulo })),
      atual: atual ? proj(atual.latitude, atual.longitude) : null,
    };
  }, [posicoes, pontos, atual]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
      <div className="flex items-center gap-2 border-b border-border/70 bg-card px-4 py-2.5">
        <Radio
          className={`size-4 ${sinal === "ao_vivo" ? "animate-pulse text-primary" : "text-muted-foreground"}`}
        />
        <span className="text-xs font-semibold">{ROTULO_SINAL[sinal]}</span>
        <span className="text-xs text-muted-foreground">
          {atual ? `última posição às ${horaLocal(atual.registrado_em)}` : "aguardando transmissão"}
        </span>
        {atual && (
          <a
            href={`https://www.google.com/maps?q=${atual.latitude},${atual.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary"
          >
            Abrir no mapa <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {traco ? (
        <svg viewBox="0 0 100 100" className="w-full" style={{ height: altura }} role="img"
          aria-label="Traçado do trajeto percorrido">
          <defs>
            <pattern id="grade" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M10 0H0V10" fill="none" stroke="currentColor" strokeWidth="0.2"
                className="text-border" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grade)" />
          {traco.linha.length > 1 && (
            <polyline
              points={traco.linha.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              className="text-primary"
            />
          )}
          {traco.marcos.map((m, i) => (
            <g key={`${m.rotulo}-${i}`}>
              <circle cx={m.x} cy={m.y} r="1.6" className="fill-accent" />
              <text x={m.x + 2.4} y={m.y + 1} className="fill-muted-foreground" fontSize="2.6">
                {m.rotulo}
              </text>
            </g>
          ))}
          {traco.atual && (
            <circle cx={traco.atual.x} cy={traco.atual.y} r="2.4" className="fill-primary">
              <animate attributeName="r" values="2.4;3.4;2.4" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma posição transmitida ainda.
        </p>
      )}
    </div>
  );
}
