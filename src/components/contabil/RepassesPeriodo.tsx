import { Banknote, QrCode } from "lucide-react";
import { brl } from "@/lib/pagamentos";
import {
  ROTULO_FINALIDADE,
  dataHora,
  type CobrancaPixContabil,
  type RepasseContabil,
} from "@/lib/contabil";
import { ROTULO_STATUS_REPASSE, type StatusRepasse } from "@/lib/carteira-motorista";

const chip = "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold";

export function RepassesPeriodo({
  repasses,
  cobrancas,
}: {
  repasses: RepasseContabil[];
  cobrancas: CobrancaPixContabil[];
}) {
  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Banknote className="size-4" /> Repasses aos motoristas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ganhos brutos do período, taxa retida pela plataforma e valor efetivamente pago em cada
          repasse (semanal automático ou saque instantâneo via Pix).
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Motorista</th>
                <th className="py-2 text-right">Ganhos brutos</th>
                <th className="py-2 text-right">Taxa retida</th>
                <th className="py-2 text-right">Valor solicitado</th>
                <th className="py-2 text-right">Tarifa do saque</th>
                <th className="py-2 text-right">Pago</th>
                <th className="py-2">Modo</th>
                <th className="py-2">Situação</th>
                <th className="py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {repasses.map((r) => (
                <tr key={r.id} className="border-t border-border/70">
                  <td className="py-3 font-medium">
                    {r.motoristaNome}
                    <span className="block text-xs text-muted-foreground">
                      #{r.motoristaId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="py-3 text-right">{brl(r.bruto)}</td>
                  <td className="py-3 text-right text-muted-foreground">{brl(r.taxaRetida)}</td>
                  <td className="py-3 text-right">{brl(r.valor)}</td>
                  <td className="py-3 text-right text-destructive">- {brl(r.taxa)}</td>
                  <td className="py-3 text-right font-bold">{brl(r.liquido)}</td>
                  <td className="py-3">
                    <span className={chip}>
                      {r.modo === "INSTANT" ? "Instantâneo" : "Semanal"} · {r.metodo}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {ROTULO_STATUS_REPASSE[r.status as StatusRepasse] ?? r.status}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {dataHora(r.processado_em ?? r.solicitado_em)}
                  </td>
                </tr>
              ))}
              {repasses.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    Nenhum repasse solicitado no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <QrCode className="size-4" /> Cobranças Pix, assinaturas e créditos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Valor base separado da taxa administrativa, para não se misturar com a receita das
          corridas.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Data</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Finalidade</th>
                <th className="py-2 text-right">Base</th>
                <th className="py-2 text-right">Taxa adm.</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Créditos</th>
                <th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => (
                <tr key={c.id} className="border-t border-border/70">
                  <td className="py-3 text-xs text-muted-foreground">{dataHora(c.criado_em)}</td>
                  <td className="py-3 font-medium">{c.clienteNome}</td>
                  <td className="py-3 text-muted-foreground">
                    {ROTULO_FINALIDADE[c.finalidade] ?? c.finalidade}
                    <span className="block text-xs">{c.descricao}</span>
                  </td>
                  <td className="py-3 text-right">{brl(c.valorBase)}</td>
                  <td className="py-3 text-right font-semibold">{brl(c.taxaAdmin)}</td>
                  <td className="py-3 text-right font-bold">{brl(c.valorTotal)}</td>
                  <td className="py-3 text-right text-muted-foreground">{brl(c.creditos)}</td>
                  <td className="py-3">
                    <span className={chip}>{c.status}</span>
                    {c.environment !== "live" && (
                      <span className="ml-1 text-xs text-muted-foreground">teste</span>
                    )}
                  </td>
                </tr>
              ))}
              {cobrancas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhuma cobrança Pix no período.
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
