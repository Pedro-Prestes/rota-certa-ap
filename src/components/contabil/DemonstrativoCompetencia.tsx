import { Download, TrendingUp } from "lucide-react";
import { brl } from "@/lib/pagamentos";
import {
  baixarCsv,
  csvCompetencias,
  rotuloCompetencia,
  type LinhaCompetencia,
} from "@/lib/contabil";

export function DemonstrativoCompetencia({ linhas }: { linhas: LinhaCompetencia[] }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <TrendingUp className="size-4" /> Demonstrativo por competência
        </h2>
        <button
          onClick={() => baixarCsv("demonstrativo-rotacerta.csv", csvCompetencias(linhas))}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-semibold"
        >
          <Download className="size-3.5" /> Exportar CSV
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Últimos 12 meses de resultado da plataforma, com a variação em relação ao mês anterior.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Competência</th>
              <th className="py-2 text-right">Receita bruta</th>
              <th className="py-2 text-right">Taxa adm.</th>
              <th className="py-2 text-right">Gateway</th>
              <th className="py-2 text-right">Repasses</th>
              <th className="py-2 text-right">Estornos</th>
              <th className="py-2 text-right">Custos</th>
              <th className="py-2 text-right">Resultado</th>
              <th className="py-2 text-right">Variação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const anterior = i > 0 ? linhas[i - 1]!.resultado : 0;
              const variacao =
                anterior !== 0 ? ((l.resultado - anterior) / Math.abs(anterior)) * 100 : null;
              return (
                <tr key={l.competencia} className="border-t border-border/70">
                  <td className="py-3 font-medium">{rotuloCompetencia(l.competencia)}</td>
                  <td className="py-3 text-right">{brl(l.receita)}</td>
                  <td className="py-3 text-right font-semibold">{brl(l.taxaPlataforma)}</td>
                  <td className="py-3 text-right text-destructive">- {brl(l.taxaGateway)}</td>
                  <td className="py-3 text-right text-muted-foreground">{brl(l.repasse)}</td>
                  <td className="py-3 text-right text-destructive">- {brl(l.estorno)}</td>
                  <td className="py-3 text-right text-destructive">- {brl(l.custos)}</td>
                  <td
                    className={`py-3 text-right font-bold ${
                      l.resultado >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {brl(l.resultado)}
                  </td>
                  <td className="py-3 text-right text-xs text-muted-foreground">
                    {variacao === null ? "—" : `${variacao > 0 ? "+" : ""}${variacao.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
