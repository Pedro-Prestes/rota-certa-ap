import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listarMunicipios } from "@/lib/municipios.functions";
import { UFS } from "@/lib/ufs";

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface Props {
  /** Rótulo do par de campos (ex.: "Ponto de origem"). */
  titulo: string;
  uf: string;
  cidade: string;
  onChange: (valor: { uf: string; cidade: string }) => void;
  /** Permite digitar distrito/vilarejo não listado pelo IBGE. */
  permitirLivre?: boolean;
}

/** Seleção de localidade em todo o Brasil: estado (UF) + município com busca. */
export function SeletorCidade({ titulo, uf, cidade, onChange, permitirLivre = true }: Props) {
  const buscar = useServerFn(listarMunicipios);
  const [filtro, setFiltro] = useState("");

  const municipios = useQuery({
    queryKey: ["municipios", uf],
    enabled: !!uf,
    staleTime: 1000 * 60 * 60 * 12,
    queryFn: async () => {
      const r = await buscar({ data: { uf } });
      if ("error" in r && r.error) throw new Error(r.error);
      return r.municipios;
    },
  });

  const lista = useMemo(() => {
    const todos = municipios.data ?? [];
    const t = filtro.trim().toLowerCase();
    return t ? todos.filter((m) => m.toLowerCase().includes(t)) : todos;
  }, [municipios.data, filtro]);

  // Ao trocar de estado, mantém a cidade só se ela pertencer à nova UF.
  useEffect(() => {
    const todos = municipios.data;
    if (!todos || todos.length === 0) return;
    if (cidade && !todos.includes(cidade) && !permitirLivre) onChange({ uf, cidade: "" });
  }, [municipios.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
      <label>
        <span className={rotulo}>Estado</span>
        <select
          className={campo}
          value={uf}
          onChange={(e) => {
            setFiltro("");
            onChange({ uf: e.target.value, cidade: "" });
          }}
          aria-label={`Estado — ${titulo}`}
        >
          {UFS.map((u) => (
            <option key={u.sigla} value={u.sigla}>
              {u.sigla}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className={rotulo}>{titulo}</span>
        <div className="relative">
          <input
            className={campo}
            value={aberto ? filtro : cidade}
            placeholder={municipios.isFetching ? "Carregando municípios…" : "Digite ou escolha a cidade"}
            onFocus={() => {
              setFiltro("");
              setAberto(true);
            }}
            onBlur={() => window.setTimeout(() => setAberto(false), 150)}
            onChange={(e) => {
              setFiltro(e.target.value);
              setAberto(true);
              if (permitirLivre) onChange({ uf, cidade: e.target.value });
            }}
            aria-label={titulo}
            autoComplete="off"
          />
          {municipios.isFetching && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}

          {aberto && lista.length > 0 && (
            <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-popover py-1 shadow-lg">
              {lista.slice(0, 300).map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    className="w-full px-3.5 py-2 text-left text-sm hover:bg-accent/20"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange({ uf, cidade: m });
                      setFiltro("");
                      setAberto(false);
                    }}
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {municipios.error
            ? (municipios.error as Error).message
            : `${(municipios.data ?? []).length} municípios em ${uf}`}
        </span>
      </div>
    </div>
  );
}

