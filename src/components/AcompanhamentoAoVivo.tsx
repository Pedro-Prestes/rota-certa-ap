import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Radio, Truck } from "lucide-react";
import { MapaViagem } from "@/components/MapaViagem";
import { supabase } from "@/integrations/supabase/client";
import { ROTULO_VIAGEM, horaLocal, type Posicao, type StatusViagem } from "@/lib/rastreio";
import { COR_SINISTRO, ROTULO_SINISTRO, type StatusSinistro } from "@/lib/seguro";

/**
 * Acompanhamento da viagem pelo passageiro: mesma informação que o motorista
 * transmite, mais o andamento do chamado quando existe uma pane.
 */
export function AcompanhamentoAoVivo({
  rotaId,
  dataViagem,
}: {
  rotaId: string;
  dataViagem: string;
}) {
  const viagem = useQuery({
    queryKey: ["viagem-passageiro", rotaId, dataViagem],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viagens")
        .select("*")
        .eq("rota_id", rotaId)
        .eq("data_viagem", dataViagem)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const viagemId = viagem.data?.id as string | undefined;

  const posicoes = useQuery({
    queryKey: ["posicoes-passageiro", viagemId],
    enabled: !!viagemId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viagem_posicoes")
        .select("latitude, longitude, registrado_em")
        .eq("viagem_id", viagemId!)
        .order("sequencia", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        registrado_em: p.registrado_em,
      })) as Posicao[];
    },
  });

  const sinistro = useQuery({
    queryKey: ["sinistro-passageiro", viagemId],
    enabled: !!viagemId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistros")
        .select("status, tipo_pane, substituto_placa, substituto_motorista, substituto_eta")
        .eq("viagem_id", viagemId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  if (!viagem.data) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <Radio className="mr-1 inline size-3" /> O motorista ainda não iniciou a transmissão desta
        saída.
      </p>
    );
  }

  const st = (viagem.data.status as StatusViagem) ?? "planejada";
  const chamado = sinistro.data;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Acompanhamento ao vivo · {ROTULO_VIAGEM[st]}
      </p>
      <MapaViagem posicoes={posicoes.data ?? []} altura={200} />
      {chamado && chamado.status !== "concluido" && chamado.status !== "cancelado" && (
        <div className="rounded-2xl bg-destructive/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" /> {chamado.tipo_pane}
          </p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${COR_SINISTRO[chamado.status as StatusSinistro]}`}
          >
            {ROTULO_SINISTRO[chamado.status as StatusSinistro]}
          </span>
          {chamado.substituto_placa && (
            <p className="mt-2 flex items-center gap-2">
              <Truck className="size-4 text-accent" /> Veículo substituto{" "}
              <strong>{chamado.substituto_placa}</strong>
              {chamado.substituto_eta ? ` — chega às ${horaLocal(chamado.substituto_eta)}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
