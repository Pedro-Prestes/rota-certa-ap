import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/logistica";
import { ANTECEDENCIA_FECHAMENTO_MIN } from "@/lib/preco-dinamico";
import { filaDaSaida } from "@/utils/pre-reserva.functions";

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

const ROTULO: Record<string, string> = {
  pendente: "Na fila",
  ofertada: "Valor ofertado",
  confirmada: "Pago",
  expirada: "Prazo vencido",
  cancelada: "Cancelada",
};

interface RotaMinima {
  id: string;
  origem: string;
  destino: string;
  saida_ida: string | null;
}

export function FechamentoMotorista() {
  const { user } = useAuth();
  const buscarFila = useServerFn(filaDaSaida);
  const [rotaId, setRotaId] = useState("");
  const [dataViagem, setDataViagem] = useState(() => new Date().toISOString().slice(0, 10));

  const rotas = useQuery({
    queryKey: ["rotas-fechamento", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select("id, origem, destino, saida_ida")
        .eq("user_id", user!.id)
        .eq("status", "ativa")
        .order("saida_ida", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RotaMinima[];
    },
  });

  const fila = useQuery({
    queryKey: ["fila-saida", rotaId, dataViagem],
    enabled: !!rotaId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const r = await buscarFila({ data: { rotaId, dataViagem } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
  });

  const fechamento = fila.data?.fechamento as
    | {
        status: string;
        assentos_prereservados: number;
        assentos_confirmados: number;
        capacidade: number;
        ocupacao: number;
        fator_aplicado: number;
        km_desvio_total: number;
        minutos_desvio_total: number;
        receita_confirmada: number;
        observacoes: string | null;
      }
    | null
    | undefined;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <Gauge className="size-4 text-accent" /> Fechamento da saída e preço dinâmico
      </h3>
      <p className="mt-2 text-xs text-muted-foreground">
        A plataforma fecha a saída {ANTECEDENCIA_FECHAMENTO_MIN} minutos antes do horário programado,
        calcula o valor conforme os assentos reservados e o desvio da rota de busca e cobra os
        passageiros um por um, preservando o horário de partida.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Saída</span>
          <select className={campo} value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
            <option value="">Escolha a saída</option>
            {(rotas.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.origem} → {r.destino} · {r.saida_ida?.slice(0, 5) ?? "--:--"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Data da viagem
          </span>
          <input
            type="date"
            className={campo}
            value={dataViagem}
            onChange={(e) => setDataViagem(e.target.value)}
          />
        </label>
      </div>

      {fila.isFetching && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Atualizando a fila…
        </p>
      )}

      {rotaId && fechamento && (
        <dl className="mt-4 grid gap-2 rounded-2xl border border-border bg-secondary/40 p-4 text-xs sm:grid-cols-2">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Situação</dt>
            <dd className="font-semibold">{fechamento.status.replace("_", " ")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ocupação</dt>
            <dd className="font-semibold">
              {fechamento.assentos_confirmados}/{fechamento.capacidade} pagos ·{" "}
              {(Number(fechamento.ocupacao) * 100).toFixed(0)}%
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Rota de busca</dt>
            <dd className="font-semibold">
              {fechamento.km_desvio_total} km · {fechamento.minutos_desvio_total} min
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Receita confirmada</dt>
            <dd className="font-semibold">{brl(Number(fechamento.receita_confirmada))}</dd>
          </div>
          {fechamento.observacoes && (
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              {fechamento.observacoes}
            </p>
          )}
        </dl>
      )}

      {rotaId && (fila.data?.itens ?? []).length === 0 && !fila.isFetching && (
        <p className="mt-4 text-xs text-muted-foreground">
          Nenhuma pré-reserva nesta data ainda.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {(fila.data?.itens ?? []).map((i) => (
          <li
            key={i.id as string}
            className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs"
          >
            <span>
              <strong>{i.assentos as number} assento(s)</strong> · {i.endereco as string}
            </span>
            <span className="whitespace-nowrap font-semibold">
              {ROTULO[i.status as string] ?? (i.status as string)}
              {i.valor_ofertado ? ` · ${brl(Number(i.valor_ofertado))}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
