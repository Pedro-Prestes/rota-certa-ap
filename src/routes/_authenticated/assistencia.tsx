import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, LifeBuoy, MapPin, Truck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, usePerfis } from "@/hooks/use-auth";
import { horaLocal } from "@/lib/rastreio";
import { COR_SINISTRO, ROTULO_SINISTRO, type StatusSinistro } from "@/lib/seguro";
import { atenderSinistro } from "@/utils/seguro.functions";
import { GuardaPerfil } from "@/components/GuardaPerfil";

export const Route = createFileRoute("/_authenticated/assistencia")({
  head: () => ({
    meta: [
      { title: "Assistência 24h | RotaCerta" },
      {
        name: "description",
        content:
          "Central de atendimento de panes: despacho de veículo substituto, reboque até a oficina e conclusão do chamado.",
      },
      { property: "og:title", content: "Assistência 24h | RotaCerta" },
      {
        property: "og:description",
        content: "Atendimento de panes com veículo substituto e remoção até a oficina indicada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistenciaProtegido,
});

const campo =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const rotulo = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Assistencia() {
  const { user } = useAuth();
  const perfis = usePerfis(user?.id);
  const ehAdmin = perfis.includes("admin");
  const [form, setForm] = useState<Record<string, { motorista: string; placa: string; eta: number; custo: number }>>({});

  const chamados = useQuery({
    queryKey: ["sinistros-admin"],
    enabled: ehAdmin,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistros")
        .select("*, oficinas(nome, endereco), viagens(rota_id, data_viagem, rotas(origem, destino))")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const acao = useMutation({
    mutationFn: async (dados: Parameters<typeof atenderSinistro>[0]["data"]) => {
      const r = await atenderSinistro({ data: dados });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado.");
      chamados.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ehAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <LifeBuoy className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Área da assistência</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Somente a administração da plataforma atende chamados de pane.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Proteção RotaCerta</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Assistência 24h</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cada chamado tem duas providências paralelas: veículo substituto para levar os
            passageiros ao destino e remoção do veículo avariado até a oficina indicada pelo
            motorista.
          </p>
        </header>

        <div className="mt-8 space-y-4">
          {(chamados.data ?? []).map((s: any) => {
            const st = s.status as StatusSinistro;
            const f = form[s.id] ?? { motorista: "", placa: "", eta: 45, custo: 0 };
            const set = (patch: Partial<typeof f>) =>
              setForm((prev) => ({ ...prev, [s.id]: { ...f, ...patch } }));
            const rota = s.viagens?.rotas;
            return (
              <article
                key={s.id}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-bold">
                      {rota ? `${rota.origem} → ${rota.destino}` : "Viagem"} ·{" "}
                      {s.viagens?.data_viagem ?? ""}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3 text-destructive" />
                      {s.tipo_pane} · aberto às {horaLocal(s.created_at)} ·{" "}
                      {s.passageiros_afetados} passageiro(s)
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${COR_SINISTRO[st]}`}>
                    {ROTULO_SINISTRO[st]}
                  </span>
                </div>

                {s.descricao && <p className="mt-3 text-sm">{s.descricao}</p>}

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {s.latitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 font-semibold text-primary"
                    >
                      <MapPin className="size-4" /> Local da pane
                    </a>
                  )}
                  {s.oficinas && (
                    <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3">
                      <Wrench className="size-4 text-accent" /> {s.oficinas.nome} — {s.oficinas.endereco}
                    </p>
                  )}
                  {s.substituto_placa && (
                    <p className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3">
                      <Truck className="size-4 text-accent" /> {s.substituto_placa} ·{" "}
                      {s.substituto_motorista} · chega {horaLocal(s.substituto_eta)}
                    </p>
                  )}
                </div>

                {st === "aberto" && (
                  <div className="mt-5 grid gap-3 rounded-2xl bg-secondary p-4 sm:grid-cols-4">
                    <label className="block sm:col-span-2">
                      <span className={rotulo}>Motorista substituto</span>
                      <input className={campo} value={f.motorista} onChange={(e) => set({ motorista: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Placa</span>
                      <input className={campo} value={f.placa} onChange={(e) => set({ placa: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Chega em (min)</span>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        className={campo}
                        value={f.eta}
                        onChange={(e) => set({ eta: Number(e.target.value) })}
                      />
                    </label>
                    <button
                      onClick={() =>
                        acao.mutate({
                          sinistroId: s.id,
                          acao: "despachar",
                          motorista: f.motorista,
                          placa: f.placa,
                          etaMinutos: f.eta,
                        })
                      }
                      disabled={acao.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:col-span-4"
                    >
                      {acao.isPending && <Loader2 className="size-4 animate-spin" />}
                      Despachar veículo substituto
                    </button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {st === "substituto_despachado" && (
                    <button
                      onClick={() => acao.mutate({ sinistroId: s.id, acao: "realocar" })}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                    >
                      Passageiros realocados
                    </button>
                  )}
                  {["substituto_despachado", "passageiros_realocados"].includes(st) && (
                    <button
                      onClick={() =>
                        acao.mutate({
                          sinistroId: s.id,
                          acao: "reboque",
                          ...(s.oficina_id ? { oficinaId: s.oficina_id } : {}),
                        })
                      }
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                    >
                      Acionar reboque
                    </button>
                  )}
                  {st === "reboque_acionado" && (
                    <button
                      onClick={() => acao.mutate({ sinistroId: s.id, acao: "na_oficina" })}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                    >
                      Veículo entregue na oficina
                    </button>
                  )}
                  {["passageiros_realocados", "reboque_acionado", "veiculo_na_oficina"].includes(st) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Custo do atendimento"
                        className="w-44 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        value={f.custo || ""}
                        onChange={(e) => set({ custo: Number(e.target.value) })}
                      />
                      <button
                        onClick={() =>
                          acao.mutate({ sinistroId: s.id, acao: "concluir", custo: f.custo || 0 })
                        }
                        className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        Concluir chamado
                      </button>
                    </div>
                  )}
                  {["aberto", "substituto_despachado"].includes(st) && (
                    <button
                      onClick={() => acao.mutate({ sinistroId: s.id, acao: "cancelar" })}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      Cancelar chamado
                    </button>
                  )}
                </div>

                {st === "concluido" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Concluído às {horaLocal(s.concluido_em)}
                  </p>
                )}
              </article>
            );
          })}
          {(chamados.data ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum chamado de pane registrado.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function AssistenciaProtegido() {
  return (
    <GuardaPerfil perfis={["admin"]}>
      <Assistencia />
    </GuardaPerfil>
  );
}
