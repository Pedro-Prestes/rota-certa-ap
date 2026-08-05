import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Blocks, CheckCircle2, Link2, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import {
  hashCurto,
  rotuloEvento,
  verificarCadeia,
  type Bloco,
  type ResultadoVerificacao,
} from "@/lib/blockchain";
import { registrarBloco } from "@/utils/blockchain.functions";
import type { Corrida } from "@/lib/pagamentos";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria em cadeia de blocos — RotaCerta" },
      {
        name: "description",
        content:
          "Todo trajeto, cobrança e estorno do RotaCerta registrado em cadeia de blocos encadeada por SHA-256, verificável por passageiros, motoristas e administradores.",
      },
      { property: "og:title", content: "Auditoria em cadeia de blocos — RotaCerta" },
      {
        property: "og:description",
        content: "Histórico imutável e verificável de trajetos, cobranças e estornos da plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auditoria,
});

interface Trajeto {
  id: string;
  corrida_id: string;
  latitude: number;
  longitude: number;
  sequencia: number;
  velocidade_kmh: number | null;
  registrado_em: string;
}

function Auditoria() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("");
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);

  const blocos = useQuery({
    queryKey: ["blocos"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blockchain_blocos")
        .select("*")
        .order("indice", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Bloco[];
    },
  });

  const corridas = useQuery({
    queryKey: ["auditoria-corridas"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corridas")
        .select("*")
        .order("data_corrida", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Corrida[];
    },
  });

  const trajetos = useQuery({
    queryKey: ["trajetos"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trajetos")
        .select("*")
        .order("sequencia", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Trajeto[];
    },
  });

  const verificar = useMutation({
    mutationFn: async () => verificarCadeia(blocos.data ?? []),
    onSuccess: (r) => {
      setResultado(r);
      if (r.valida) toast.success(`Cadeia íntegra: ${r.total} bloco(s) conferido(s).`);
      else toast.error(r.motivo ?? "Cadeia inconsistente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrar = useMutation({
    mutationFn: async (corridaId: string) => {
      const r = await registrarBloco({
        data: { evento: "corrida_criada", corridaId, dados: { origem_registro: "painel" } },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      toast.success(`Bloco #${r.indice} registrado.`);
      qc.invalidateQueries({ queryKey: ["blocos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = useMemo(() => {
    const todos = blocos.data ?? [];
    return filtro ? todos.filter((b) => b.corrida_id === filtro) : todos;
  }, [blocos.data, filtro]);

  const nomeCorrida = (id: string | null) => {
    const c = (corridas.data ?? []).find((x) => x.id === id);
    return c ? `${c.origem || "—"} → ${c.destino || "—"}` : "Plataforma";
  };

  const pontosDe = (id: string) => (trajetos.data ?? []).filter((t) => t.corrida_id === id);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Blocks className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Auditoria em cadeia de blocos
            </h1>
            <p className="text-sm text-muted-foreground">
              Cada evento gera um bloco com o hash do anterior — qualquer alteração retroativa é
              detectada por qualquer ator da plataforma.
            </p>
          </div>
          <button
            onClick={() => verificar.mutate()}
            disabled={verificar.isPending}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {verificar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Verificar cadeia
          </button>
        </div>

        {resultado && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
              resultado.valida
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {resultado.valida ? (
              <CheckCircle2 className="mt-0.5 size-5" />
            ) : (
              <ShieldAlert className="mt-0.5 size-5" />
            )}
            <p>
              {resultado.valida
                ? `Cadeia íntegra — ${resultado.total} bloco(s) recalculados com SHA-256 e confirmados.`
                : resultado.motivo}
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Corridas
            </h2>
            <button
              onClick={() => setFiltro("")}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                filtro === "" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              Todos os eventos
            </button>
            <div className="mt-1 space-y-1">
              {(corridas.data ?? []).map((c) => {
                const pontos = pontosDe(c.id);
                return (
                  <div key={c.id} className="rounded-xl border border-border/60 p-2">
                    <button
                      onClick={() => setFiltro(c.id)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
                        filtro === c.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                      }`}
                    >
                      {c.origem || "—"} → {c.destino || "—"}
                    </button>
                    <p className="mt-1 flex items-center gap-1 px-2 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {pontos.length} ponto(s) de trajeto ·{" "}
                      {Number(c.distancia_km)} km
                    </p>
                    <button
                      onClick={() => registrar.mutate(c.id)}
                      disabled={registrar.isPending}
                      className="mt-2 w-full rounded-lg border border-border px-2 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Registrar na cadeia
                    </button>
                  </div>
                );
              })}
              {(corridas.data ?? []).length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma corrida cadastrada.</p>
              )}
            </div>
          </aside>

          <div className="space-y-3">
            {blocos.isLoading && (
              <p className="text-sm text-muted-foreground">Carregando blocos…</p>
            )}
            {lista.map((b) => (
              <article key={b.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                    #{b.indice}
                  </span>
                  <h3 className="font-display font-bold">{rotuloEvento(b.evento)}</h3>
                  <span className="text-xs text-muted-foreground">{nomeCorrida(b.corrida_id)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Hash anterior</dt>
                    <dd className="font-mono">{hashCurto(b.hash_anterior)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Hash deste bloco</dt>
                    <dd className="font-mono">{hashCurto(b.hash)}</dd>
                  </div>
                </dl>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-secondary/60 p-3 text-xs">
                  {JSON.stringify(b.dados, null, 2)}
                </pre>
              </article>
            ))}
            {!blocos.isLoading && lista.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <Blocks className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">Nenhum bloco registrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Registre uma corrida na cadeia ou realize uma cobrança online para gerar o primeiro
                  bloco.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
