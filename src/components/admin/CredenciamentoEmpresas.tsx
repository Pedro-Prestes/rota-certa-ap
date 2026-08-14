import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Building2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { ROTULO_STATUS_DOC } from "@/lib/credenciamento-pj";
import { formatarCnpj } from "@/lib/frotista";
import {
  decidirDocumentoPJ,
  filaCredenciamentoPJ,
} from "@/utils/credenciamento-pj.functions";

const cartao = "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]";

/**
 * Autorização do credenciamento de cooperativas e frotistas.
 * A entrada em operação depende exclusivamente da decisão do master.
 */
export function CredenciamentoEmpresas() {
  const qc = useQueryClient();
  const buscar = useServerFn(filaCredenciamentoPJ);
  const decidir = useServerFn(decidirDocumentoPJ);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const fila = useQuery({
    queryKey: ["fila-credenciamento-pj"],
    queryFn: () => buscar({ data: undefined }),
  });

  const decisao = useMutation({
    mutationFn: async (v: {
      documentoId: string;
      decisao: "aprovado" | "reprovado";
      motivo?: string;
    }) => {
      const r = await decidir({ data: v });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      toast.success("Decisão registrada e auditada na cadeia de blocos.");
      void qc.invalidateQueries({ queryKey: ["fila-credenciamento-pj"] });
      void qc.invalidateQueries({ queryKey: ["credenciamento-pj"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = fila.data?.itens ?? [];
  const pendentes = useMemo(() => itens.filter((i) => i.status === "em_analise"), [itens]);
  const decididos = useMemo(() => itens.filter((i) => i.status !== "em_analise"), [itens]);

  if (fila.data?.error) {
    return (
      <section className={cartao}>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck className="size-5 text-primary" /> Credenciamento de empresas
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{fila.data.error}</p>
      </section>
    );
  }

  return (
    <section className={cartao}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <ShieldCheck className="size-5 text-primary" /> Credenciamento de empresas
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A análise automática apenas confere as pendências. Cooperativas e frotistas só entram em
        operação (fase 3 — frota e condutores) depois da sua autorização.
      </p>

      {fila.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando fila de análise…
        </p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold">
            Aguardando autorização ({pendentes.length})
          </h3>
          {!pendentes.length && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum documento aguardando decisão.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {pendentes.map((i) => (
              <li key={i.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  <strong className="text-sm">{i.empresa}</strong>
                  <span className="text-xs text-muted-foreground">
                    {i.cnpj ? formatarCnpj(i.cnpj) : ""} · {i.tipo_entidade} · resp.{" "}
                    {i.responsavel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Documento: <strong>{i.tipo_documento}</strong>
                  {i.numero ? ` · nº ${i.numero}` : ""}
                  {i.orgao_emissor ? ` · ${i.orgao_emissor}` : ""}
                  {i.validade ? ` · validade ${i.validade}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={motivos[i.id] ?? ""}
                    onChange={(e) => setMotivos((m) => ({ ...m, [i.id]: e.target.value }))}
                    placeholder="Motivo (obrigatório para reprovar)"
                    className="min-w-56 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    disabled={decisao.isPending}
                    onClick={() =>
                      decisao.mutate({ documentoId: i.id, decisao: "aprovado" })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    <BadgeCheck className="size-4" /> Autorizar
                  </button>
                  <button
                    type="button"
                    disabled={decisao.isPending}
                    onClick={() =>
                      decisao.mutate({
                        documentoId: i.id,
                        decisao: "reprovado",
                        motivo: motivos[i.id] ?? "",
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-destructive px-3.5 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
                  >
                    <XCircle className="size-4" /> Reprovar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {decididos.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold">Histórico de decisões</h3>
              <ul className="mt-3 space-y-2">
                {decididos.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/60 p-3 text-xs"
                  >
                    <strong className="text-sm">{i.empresa}</strong>
                    <span className="text-muted-foreground">{i.tipo_documento}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        i.status === "aprovado"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {ROTULO_STATUS_DOC[i.status]}
                    </span>
                    {i.motivo_reprovacao && (
                      <span className="text-muted-foreground">{i.motivo_reprovacao}</span>
                    )}
                    <button
                      type="button"
                      disabled={decisao.isPending}
                      onClick={() =>
                        decisao.mutate({
                          documentoId: i.id,
                          decisao: i.status === "aprovado" ? "reprovado" : "aprovado",
                          motivo: motivos[i.id] ?? "Revisão do administrador master.",
                        })
                      }
                      className="ml-auto font-semibold text-primary underline"
                    >
                      {i.status === "aprovado" ? "Revogar" : "Autorizar"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
