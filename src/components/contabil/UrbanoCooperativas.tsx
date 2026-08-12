import { Building2, Car, Download } from "lucide-react";
import { brl } from "@/lib/pagamentos";
import {
  ROTULO_FORMA,
  baixarCsv,
  csvCorridasUrbanas,
  csvRateioCooperativas,
  dataHora,
  type CorridaUrbanaContabil,
  type PeriodoContabil,
  type RateioCooperativaContabil,
} from "@/lib/contabil";

interface Props {
  periodo: PeriodoContabil;
  urbano: {
    corridas: number;
    base: number;
    taxaAdministrativa: number;
    total: number;
    parcelaPlataforma: number;
    parcelaCooperativa: number;
    linhas: CorridaUrbanaContabil[];
  };
  cooperativas: RateioCooperativaContabil[];
}

const botao =
  "inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold";

/** Corridas urbanas do período e o rateio da taxa administrativa por cooperativa. */
export function UrbanoCooperativas({ periodo, urbano, cooperativas }: Props) {
  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Car className="size-5 text-primary" /> Corridas urbanas
          </h2>
          <button
            type="button"
            className={botao}
            onClick={() =>
              baixarCsv(
                `corridas-urbanas-${periodo.de}-a-${periodo.ate}.csv`,
                csvCorridasUrbanas(urbano.linhas),
              )
            }
          >
            <Download className="size-4" /> Exportar CSV
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["Corridas concluídas", String(urbano.corridas)],
            ["Base das corridas", brl(urbano.base)],
            ["Taxa administrativa", brl(urbano.taxaAdministrativa)],
            ["Parcela da plataforma", brl(urbano.parcelaPlataforma)],
            ["Parcela das cooperativas", brl(urbano.parcelaCooperativa)],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="rounded-xl border border-border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {titulo}
              </p>
              <p className="mt-1 font-display text-lg font-bold">{valor}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Data</th>
                <th className="py-2">Praça</th>
                <th className="py-2">Meio</th>
                <th className="py-2 text-right">Base</th>
                <th className="py-2 text-right">Taxa</th>
                <th className="py-2 text-right">Plataforma</th>
                <th className="py-2 text-right">Cooperativa</th>
                <th className="py-2">Entidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {urbano.linhas.slice(0, 100).map((l) => (
                <tr key={l.id}>
                  <td className="py-2 whitespace-nowrap">
                    {l.concluida_em ? dataHora(l.concluida_em) : "—"}
                  </td>
                  <td className="py-2">{l.municipio}</td>
                  <td className="py-2">{ROTULO_FORMA[l.forma] ?? l.forma}</td>
                  <td className="py-2 text-right">{brl(l.base)}</td>
                  <td className="py-2 text-right">{brl(l.taxaAdministrativa)}</td>
                  <td className="py-2 text-right">{brl(l.parcelaPlataforma)}</td>
                  <td className="py-2 text-right">{brl(l.parcelaCooperativa)}</td>
                  <td className="py-2 text-muted-foreground">{l.cooperativa ?? "—"}</td>
                </tr>
              ))}
              {urbano.linhas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-muted-foreground">
                    Nenhuma corrida urbana concluída neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Building2 className="size-5 text-primary" /> Rateio das cooperativas
          </h2>
          <button
            type="button"
            className={botao}
            onClick={() =>
              baixarCsv(
                `rateio-cooperativas-${periodo.de}-a-${periodo.ate}.csv`,
                csvRateioCooperativas(cooperativas),
              )
            }
          >
            <Download className="size-4" /> Exportar CSV
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Cooperativa</th>
                <th className="py-2">CNPJ</th>
                <th className="py-2">Praça</th>
                <th className="py-2 text-right">Corridas</th>
                <th className="py-2 text-right">Rateado</th>
                <th className="py-2 text-right">Repassado</th>
                <th className="py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cooperativas.map((c) => (
                <tr key={c.cooperativaId}>
                  <td className="py-2 font-semibold">{c.nome}</td>
                  <td className="py-2 text-muted-foreground">{c.cnpj}</td>
                  <td className="py-2 text-muted-foreground">{c.praca || "—"}</td>
                  <td className="py-2 text-right">{c.corridas}</td>
                  <td className="py-2 text-right">{brl(c.rateado)}</td>
                  <td className="py-2 text-right">{brl(c.repassado)}</td>
                  <td className="py-2 text-right font-semibold">{brl(c.saldo)}</td>
                </tr>
              ))}
              {cooperativas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-muted-foreground">
                    Nenhum rateio de cooperativa neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
