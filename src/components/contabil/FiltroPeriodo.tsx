import { CalendarRange } from "lucide-react";
import { ATALHOS, type AtalhoPeriodo, type PeriodoContabil } from "@/lib/contabil";

const campo =
  "rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function FiltroPeriodo({
  atalho,
  periodo,
  onAtalho,
  onPeriodo,
}: {
  atalho: AtalhoPeriodo;
  periodo: PeriodoContabil;
  onAtalho: (a: AtalhoPeriodo) => void;
  onPeriodo: (p: PeriodoContabil) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CalendarRange className="size-4" /> Período de competência
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            onClick={() => onAtalho(a.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              atalho === a.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {atalho === "custom" && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            De
            <input
              type="date"
              className={`mt-1 block ${campo}`}
              value={periodo.de}
              onChange={(e) => onPeriodo({ ...periodo, de: e.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Até
            <input
              type="date"
              className={`mt-1 block ${campo}`}
              value={periodo.ate}
              onChange={(e) => onPeriodo({ ...periodo, ate: e.target.value })}
            />
          </label>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {new Date(`${periodo.de}T12:00:00`).toLocaleDateString("pt-BR")} até{" "}
        {new Date(`${periodo.ate}T12:00:00`).toLocaleDateString("pt-BR")}
      </p>
    </section>
  );
}
