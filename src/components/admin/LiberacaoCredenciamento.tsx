import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Loader2, Search, ShieldCheck, Undo2 } from "lucide-react";
import {
  liberarCredenciamento,
  listarMotoristasLiberacao,
  revogarLiberacaoCredenciamento,
} from "@/utils/credenciamento-liberacao.functions";

interface Selecao {
  fase1: boolean;
  fase2: boolean;
  fase3: boolean;
  motivo: string;
}

const vazio: Selecao = { fase1: true, fase2: true, fase3: true, motivo: "" };

/**
 * Ativação do credenciamento do motorista pelo administrador master, mesmo com
 * as fases 1, 2 e 3 irregulares. Todas as decisões são auditadas.
 */
export function LiberacaoCredenciamento() {
  const qc = useQueryClient();
  const buscar = useServerFn(listarMotoristasLiberacao);
  const liberar = useServerFn(liberarCredenciamento);
  const revogar = useServerFn(revogarLiberacaoCredenciamento);

  const [termo, setTermo] = useState("");
  const [form, setForm] = useState<Record<string, Selecao>>({});

  const lista = useQuery({
    queryKey: ["liberacao-credenciamento", termo],
    queryFn: () => buscar({ data: { termo } }),
  });

  const acao = useMutation({
    mutationFn: async (v: { userId: string; revogar?: boolean } & Partial<Selecao>) => {
      const r = v.revogar
        ? await revogar({ data: { userId: v.userId } })
        : await liberar({
            data: {
              userId: v.userId,
              fase1: !!v.fase1,
              fase2: !!v.fase2,
              fase3: !!v.fase3,
              motivo: v.motivo ?? "",
            },
          });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (_r, v) => {
      toast.success(
        v.revogar ? "Liberação revogada — regras normais restauradas." : "Credenciamento liberado.",
      );
      void qc.invalidateQueries({ queryKey: ["liberacao-credenciamento"] });
      void qc.invalidateQueries({ queryKey: ["credenciamento-liberacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (lista.data?.error) {
    return null;
  }

  const motoristas = lista.data?.motoristas ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <KeyRound className="size-4" /> Liberação do credenciamento (master)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ativa o credenciamento do motorista nas fases 1, 2 e 3 mesmo que estejam irregulares. A
        decisão é registrada na cadeia de blocos com o motivo informado.
      </p>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      {lista.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando motoristas…
        </p>
      ) : motoristas.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum motorista encontrado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {motoristas.map((m) => {
            const f = form[m.user_id] ?? vazio;
            const ativa = m.liberacao;
            return (
              <li key={m.user_id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.nome}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                  {ativa && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                      <ShieldCheck className="size-3" /> Liberado pelo master
                    </span>
                  )}
                </div>

                {ativa ? (
                  <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <p>
                      Fases liberadas:{" "}
                      {[ativa.fase1 && "1", ativa.fase2 && "2", ativa.fase3 && "3"]
                        .filter(Boolean)
                        .join(", ") || "nenhuma"}
                    </p>
                    <p>Motivo: {ativa.motivo}</p>
                    <button
                      onClick={() => acao.mutate({ userId: m.user_id, revogar: true })}
                      disabled={acao.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                    >
                      <Undo2 className="size-3.5" /> Revogar liberação
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-3 text-xs">
                      {([1, 2, 3] as const).map((n) => {
                        const chave = `fase${n}` as "fase1" | "fase2" | "fase3";
                        return (
                          <label key={n} className="inline-flex items-center gap-1.5 font-semibold">
                            <input
                              type="checkbox"
                              checked={f[chave]}
                              onChange={(e) =>
                                setForm((s) => ({
                                  ...s,
                                  [m.user_id]: { ...f, [chave]: e.target.checked },
                                }))
                              }
                            />
                            Fase {n}
                          </label>
                        );
                      })}
                    </div>
                    <textarea
                      value={f.motivo}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [m.user_id]: { ...f, motivo: e.target.value } }))
                      }
                      rows={2}
                      placeholder="Motivo da liberação (obrigatório, mínimo 10 caracteres)"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={() => acao.mutate({ userId: m.user_id, ...f })}
                      disabled={acao.isPending || f.motivo.trim().length < 10}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {acao.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      Ativar credenciamento
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
