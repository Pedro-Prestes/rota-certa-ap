import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bus, Loader2, Route as RouteIcon, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { excluirRota } from "@/lib/excluir-rota";

interface RotaAdmin {
  id: string;
  origem: string;
  destino: string;
  uf_origem: string | null;
  uf_destino: string | null;
  saida_ida: string | null;
  assentos: number;
  preco_assento: number;
  status: string;
  frotista_id: string | null;
}

interface VeiculoAdmin {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  assentos: number;
  categoria: string;
  status_operacional: string;
  frotista_id: string | null;
}

const botaoExcluir =
  "inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60";

/** Controle geral do administrador master: exclusão de rotas e de veículos da frota. */
export function ControleGeral() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const rotas = useQuery({
    queryKey: ["admin-rotas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select(
          "id, origem, destino, uf_origem, uf_destino, saida_ida, assentos, preco_assento, status, frotista_id",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RotaAdmin[];
    },
  });

  const veiculos = useQuery({
    queryKey: ["admin-veiculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select(
          "id, placa, marca, modelo, ano, assentos, categoria, status_operacional, frotista_id",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VeiculoAdmin[];
    },
  });

  const removerRota = useMutation({
    mutationFn: (id: string) => excluirRota(id),
    onSuccess: () => {
      toast.success("Rota excluída.");
      void qc.invalidateQueries({ queryKey: ["admin-rotas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspenderRota = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rotas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação da rota atualizada.");
      void qc.invalidateQueries({ queryKey: ["admin-rotas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removerVeiculo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("veiculos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Veículo excluído da frota.");
      void qc.invalidateQueries({ queryKey: ["admin-veiculos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const termo = busca.trim().toLowerCase();

  const rotasFiltradas = useMemo(() => {
    const lista = rotas.data ?? [];
    if (!termo) return lista;
    return lista.filter((r) =>
      `${r.origem} ${r.destino} ${r.uf_origem ?? ""} ${r.uf_destino ?? ""}`
        .toLowerCase()
        .includes(termo),
    );
  }, [rotas.data, termo]);

  const veiculosFiltrados = useMemo(() => {
    const lista = veiculos.data ?? [];
    if (!termo) return lista;
    return lista.filter((v) =>
      `${v.placa} ${v.marca} ${v.modelo} ${v.categoria}`.toLowerCase().includes(termo),
    );
  }, [veiculos.data, termo]);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <RouteIcon className="size-4" /> Controle geral · rotas e frota
        </h2>
        <label className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar rota, placa ou modelo"
            className="w-56 bg-transparent text-sm outline-none"
          />
        </label>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        O administrador master pode suspender ou excluir qualquer rota publicada e remover veículos de
        qualquer frota. Rotas com viagens já registradas não podem ser excluídas — apenas suspensas.
      </p>

      <h3 className="mt-5 text-xs font-semibold uppercase text-muted-foreground">
        Rotas ({rotasFiltradas.length})
      </h3>
      {rotas.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando rotas…
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rotasFiltradas.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 p-3 text-sm"
            >
              <span className="font-semibold">
                {r.origem}
                {r.uf_origem ? ` (${r.uf_origem})` : ""} → {r.destino}
                {r.uf_destino ? ` (${r.uf_destino})` : ""}
              </span>
              <span className="text-muted-foreground">
                {r.saida_ida?.slice(0, 5) ?? "—"} · {r.assentos} assentos
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {r.status}
              </span>
              {r.frotista_id && (
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  frotista
                </span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={suspenderRota.isPending}
                  onClick={() =>
                    suspenderRota.mutate({
                      id: r.id,
                      status: r.status === "ativa" ? "suspensa" : "ativa",
                    })
                  }
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  {r.status === "ativa" ? "Suspender" : "Reativar"}
                </button>
                <button
                  type="button"
                  disabled={removerRota.isPending}
                  onClick={() => {
                    if (!window.confirm(`Excluir a rota ${r.origem} → ${r.destino}?`)) return;
                    removerRota.mutate(r.id);
                  }}
                  className={botaoExcluir}
                >
                  <Trash2 className="size-3.5" /> Excluir
                </button>
              </div>
            </li>
          ))}
          {rotasFiltradas.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma rota encontrada.</li>
          )}
        </ul>
      )}

      <h3 className="mt-7 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Bus className="size-3.5" /> Frota ({veiculosFiltrados.length})
      </h3>
      {veiculos.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando veículos…
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {veiculosFiltrados.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 p-3 text-sm"
            >
              <span className="font-semibold">{v.placa}</span>
              <span className="text-muted-foreground">
                {v.marca} {v.modelo} · {v.ano} · {v.assentos} assentos
              </span>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                {v.status_operacional}
              </span>
              {v.frotista_id && (
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  frotista
                </span>
              )}
              <button
                type="button"
                disabled={removerVeiculo.isPending}
                onClick={() => {
                  if (!window.confirm(`Excluir o veículo ${v.placa} da frota?`)) return;
                  removerVeiculo.mutate(v.id);
                }}
                className={`ml-auto ${botaoExcluir}`}
              >
                <Trash2 className="size-3.5" /> Excluir
              </button>
            </li>
          ))}
          {veiculosFiltrados.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Nenhum veículo encontrado.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
