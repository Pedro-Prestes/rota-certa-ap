import { useState } from "react";
import { ChevronRight, Download, FileSpreadsheet, Search } from "lucide-react";
import { brl } from "@/lib/pagamentos";
import {
  ROTULO_FORMA,
  baixarCsv,
  csvTransacoes,
  dataHora,
  type TransacaoContabil,
} from "@/lib/contabil";
import { rotuloTipo, sinalTipo } from "@/lib/taxas";

const chip = "rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold";

export function ExtratoTransacoes({
  transacoes,
  onEstornar,
}: {
  transacoes: TransacaoContabil[];
  onEstornar: (pagamentoId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const porPagina = 25;

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? transacoes.filter((t) =>
        [t.clienteNome, t.clienteCurto, t.rota, t.motorista, t.forma, t.autorizacao ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(termo),
      )
    : transacoes;

  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtradas.slice(atual * porPagina, atual * porPagina + porPagina);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <FileSpreadsheet className="size-4" /> Extrato de transações
        </h2>
        <span className={chip}>{filtradas.length} lançamentos</span>
        <button
          onClick={() => baixarCsv("transacoes-rotacerta.csv", csvTransacoes(filtradas))}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-semibold"
        >
          <Download className="size-3.5" /> Exportar CSV
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Buscar por cliente, ID da conta, rota ou motorista"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
        />
      </label>

      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Data</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Rota</th>
              <th className="py-2">Meio</th>
              <th className="py-2 text-right">Base</th>
              <th className="py-2 text-right">Taxa adm.</th>
              <th className="py-2 text-right">Gateway</th>
              <th className="py-2 text-right">Repasse</th>
              <th className="py-2 text-right">Líquido</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((t) => (
              <tr
                key={t.id}
                onClick={() => setAberta(t.id)}
                className="cursor-pointer border-t border-border/70 hover:bg-secondary/50"
              >
                <td className="py-3 text-muted-foreground">{dataHora(t.pago_em)}</td>
                <td className="py-3">
                  <span className="font-medium">{t.clienteNome}</span>
                  <span className="block text-xs text-muted-foreground">#{t.clienteCurto}</span>
                </td>
                <td className="py-3 text-muted-foreground">
                  {t.rota}
                  <span className="block text-xs">{t.motorista}</span>
                </td>
                <td className="py-3">
                  <span className={chip}>{ROTULO_FORMA[t.forma] ?? t.forma}</span>
                  {t.status !== "pago" && (
                    <span className="ml-1 text-xs text-destructive">{t.status}</span>
                  )}
                </td>
                <td className="py-3 text-right">{brl(t.base)}</td>
                <td className="py-3 text-right font-semibold">{brl(t.taxaAdministrativa)}</td>
                <td className="py-3 text-right text-destructive">- {brl(t.taxaGateway)}</td>
                <td className="py-3 text-right text-muted-foreground">{brl(t.repasseMotorista)}</td>
                <td className="py-3 text-right font-bold">{brl(t.liquidoPlataforma)}</td>
                <td className="py-3 text-right">
                  <ChevronRight className="inline size-4 text-muted-foreground" />
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-muted-foreground">
                  Nenhuma transação no período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 lg:hidden">
        {visiveis.map((t) => (
          <button
            key={t.id}
            onClick={() => setAberta(t.id)}
            className="w-full rounded-xl border border-border p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t.clienteNome}</span>
              <span className="ml-auto font-bold">{brl(t.total)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dataHora(t.pago_em)} · {ROTULO_FORMA[t.forma] ?? t.forma} · #{t.clienteCurto}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.rota}</p>
            <p className="mt-1 text-xs">
              Taxa adm. <strong>{brl(t.taxaAdministrativa)}</strong> · Repasse{" "}
              {brl(t.repasseMotorista)}
            </p>
          </button>
        ))}
        {visiveis.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma transação no período selecionado.
          </p>
        )}
      </div>

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            onClick={() => setPagina(Math.max(0, atual - 1))}
            disabled={atual === 0}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-muted-foreground">
            Página {atual + 1} de {paginas}
          </span>
          <button
            onClick={() => setPagina(Math.min(paginas - 1, atual + 1))}
            disabled={atual >= paginas - 1}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {aberta && (
        <DetalheTransacao
          transacao={filtradas.find((t) => t.id === aberta)!}
          onFechar={() => setAberta(null)}
          onEstornar={onEstornar}
        />
      )}
    </section>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={`flex justify-between ${forte ? "border-t border-border pt-1" : ""}`}>
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={forte ? "font-bold" : "font-semibold"}>{valor}</span>
    </div>
  );
}

function DetalheTransacao({
  transacao: t,
  onFechar,
  onEstornar,
}: {
  transacao: TransacaoContabil;
  onFechar: () => void;
  onEstornar: (pagamentoId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        className="my-8 w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">Detalhe da transação</h3>
            <p className="text-xs text-muted-foreground">
              {dataHora(t.pago_em)} · competência {t.competencia}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente pagador</p>
            <p className="mt-1 font-semibold">{t.clienteNome}</p>
            <p className="text-xs text-muted-foreground">ID da conta #{t.clienteCurto}</p>
            {t.clienteContato && (
              <p className="text-xs text-muted-foreground">{t.clienteContato}</p>
            )}
          </div>
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Corrida</p>
            <p className="mt-1 font-semibold">{t.rota}</p>
            <p className="text-xs text-muted-foreground">
              Motorista {t.motorista}
              {t.veiculo ? ` · ${t.veiculo}` : ""}
              {t.assentos ? ` · ${t.assentos} assento(s)` : ""}
            </p>
            {t.dataCorrida && (
              <p className="text-xs text-muted-foreground">
                Viagem em {new Date(`${t.dataCorrida}T12:00:00`).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1 rounded-xl bg-secondary/60 p-4 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Composição da cobrança
          </p>
          <Linha rotulo="Serviço de transporte (base)" valor={brl(t.base)} />
          <Linha
            rotulo={`Taxa administrativa variável (${t.taxaPercentual}%)`}
            valor={brl(t.taxaVariavel)}
          />
          <Linha rotulo="Taxa administrativa fixa" valor={brl(t.taxaFixa)} />
          <Linha rotulo="Total cobrado do cliente" valor={brl(t.total)} forte />
          <Linha rotulo="Tarifa do gateway" valor={`- ${brl(t.taxaGateway)}`} />
          <Linha rotulo="Repasse ao motorista" valor={brl(t.repasseMotorista)} />
          {t.estornado > 0 && (
            <Linha rotulo="Estornado ao cliente" valor={`- ${brl(t.estornado)}`} />
          )}
          <Linha rotulo="Resultado líquido da plataforma" valor={brl(t.liquidoPlataforma)} forte />
        </div>

        <div className="mt-3 rounded-xl border border-border p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Referências</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meio: {ROTULO_FORMA[t.forma] ?? t.forma}
            {t.parcelas > 1 ? ` em ${t.parcelas}x` : ""} · Situação: {t.status}
            {t.bandeira ? ` · ${t.bandeira}` : ""}
          </p>
          {t.autorizacao && (
            <p className="text-xs text-muted-foreground">Autorização: {t.autorizacao}</p>
          )}
          {t.chave_pix && <p className="text-xs text-muted-foreground">Pix: {t.chave_pix}</p>}
          <p className="text-xs text-muted-foreground">Pagamento #{t.id.slice(0, 8)}</p>
        </div>

        {t.lancamentos.length > 0 && (
          <div className="mt-3 rounded-xl border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Lançamentos contábeis vinculados
            </p>
            <ul className="mt-2 space-y-1">
              {t.lancamentos.map((l) => (
                <li key={l.id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {rotuloTipo(l.tipo)} — {l.descricao}
                  </span>
                  <span className={sinalTipo(l.tipo) < 0 ? "text-destructive" : ""}>
                    {sinalTipo(l.tipo) < 0 ? "- " : ""}
                    {brl(l.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {t.estornos.length > 0 && (
          <div className="mt-3 rounded-xl border border-border p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Estornos</p>
            <ul className="mt-2 space-y-1">
              {t.estornos.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{brl(e.valor)}</span>
                  <span className={chip}>{e.integral ? "integral" : "parcial"}</span>
                  <span className={chip}>{e.status}</span>
                  <span className="text-xs text-muted-foreground">{e.motivo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => {
            onEstornar(t.id);
            onFechar();
          }}
          disabled={t.status === "estornado"}
          className="mt-4 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Estornar valor (integral ou parcial)
        </button>
      </div>
    </div>
  );
}
