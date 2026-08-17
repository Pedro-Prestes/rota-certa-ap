import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgePercent, Loader2, Megaphone, X } from "lucide-react";
import { brl } from "@/lib/logistica";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL } from "@/lib/dados";
import {
  DESCONTO_RETORNO_PADRAO,
  descontoVigente,
  tabelaDescontos,
  type DescontoRota,
  type TrechoDesconto,
} from "@/lib/descontos";
import {
  definirDescontoRota,
  descontosDaMinhaRota,
  encerrarDescontoRota,
} from "@/utils/desconto.functions";

export interface RotaDesconto {
  id: string;
  origem: string;
  destino: string;
  preco_assento: number;
  distancia_km: number;
  assentos: number;
  saida_retorno?: string | null;
}

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

/**
 * Painel do motorista/frotista para publicar desconto promocional em uma rota,
 * com a tabela de níveis e a margem estimada de cada opção.
 */
export function DescontoPromocional({ rotas }: { rotas: RotaDesconto[] }) {
  const qc = useQueryClient();
  const publicar = useServerFn(definirDescontoRota);
  const encerrar = useServerFn(encerrarDescontoRota);
  const listar = useServerFn(descontosDaMinhaRota);

  const [rotaId, setRotaId] = useState(rotas[0]?.id ?? "");
  const [percentual, setPercentual] = useState(10);
  const [trecho, setTrecho] = useState<TrechoDesconto>("ambos");
  const [fim, setFim] = useState("");
  const [salvando, setSalvando] = useState(false);

  const rota = rotas.find((r) => r.id === rotaId) ?? rotas[0] ?? null;

  const descontos = useQuery({
    queryKey: ["descontos-rota", rota?.id],
    enabled: !!rota,
    queryFn: async () => {
      const r = await listar({ data: { rotaId: rota!.id } });
      if ("error" in r) throw new Error(r.error as string);
      return r.descontos as DescontoRota[];
    },
  });

  const vigente = useMemo(
    () => descontoVigente(descontos.data, trecho === "volta" ? "volta" : "ida"),
    [descontos.data, trecho],
  );

  const tabela = useMemo(
    () =>
      rota
        ? tabelaDescontos({
            precoAssento: Number(rota.preco_assento) || 0,
            distanciaKm: Number(rota.distancia_km) || 0,
            assentos: Number(rota.assentos) || 1,
            precoCombustivel: PRECO_COMBUSTIVEL,
            consumoKmL: CONSUMO_KM_L,
          })
        : [],
    [rota],
  );

  if (rotas.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Publique uma rota para liberar o desconto promocional.
      </div>
    );
  }

  const aplicar = async () => {
    if (!rota) return;
    setSalvando(true);
    try {
      const r = await publicar({
        data: {
          rotaId: rota.id,
          percentual,
          trecho,
          ...(fim ? { fim: new Date(fim).toISOString() } : {}),
        },
      });
      if ("error" in r) throw new Error(r.error as string);
      toast.success(
        `Promoção de ${percentual}% publicada: assento por ${brl(r.precoNovo)}.${
          r.avisados > 0 ? ` Avisamos ${r.avisados} passageiro(s).` : ""
        }`,
      );
      void qc.invalidateQueries({ queryKey: ["descontos-rota"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível publicar o desconto.");
    } finally {
      setSalvando(false);
    }
  };

  const parar = async () => {
    if (!rota) return;
    setSalvando(true);
    try {
      const r = await encerrar({ data: { rotaId: rota.id } });
      if ("error" in r) throw new Error(r.error as string);
      toast.success("Promoção encerrada.");
      void qc.invalidateQueries({ queryKey: ["descontos-rota"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível encerrar o desconto.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <BadgePercent className="size-4 text-accent" /> Desconto promocional
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Ligue ou desligue a promoção quando quiser. O desconto incide sobre o valor dos assentos (a
        taxa administrativa continua igual) e o passageiro recebe um aviso destacado na busca. No
        trecho de volta da viagem casada já aplicamos {DESCONTO_RETORNO_PADRAO}% por padrão.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Rota</span>
          <select className={campo} value={rota?.id ?? ""} onChange={(e) => setRotaId(e.target.value)}>
            {rotas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.origem} → {r.destino} · {brl(Number(r.preco_assento))}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Trecho</span>
          <select
            className={campo}
            value={trecho}
            onChange={(e) => setTrecho(e.target.value as TrechoDesconto)}
          >
            <option value="ambos">Ida e volta</option>
            <option value="ida">Somente ida</option>
            <option value="volta">Somente volta</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Desconto (%)
          </span>
          <input
            type="number"
            min={1}
            max={25}
            className={campo}
            value={percentual}
            onChange={(e) =>
              setPercentual(Math.min(25, Math.max(1, Math.round(Number(e.target.value) || 0))))
            }
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Válido até (opcional)
          </span>
          <input
            type="datetime-local"
            className={campo}
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </label>
      </div>

      {/* Tabela de níveis sugeridos com a margem estimada */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 font-semibold">Nível</th>
              <th className="pb-2 font-semibold">Desconto</th>
              <th className="pb-2 font-semibold">Quando usar</th>
              <th className="pb-2 font-semibold">Assento</th>
              <th className="pb-2 font-semibold">Margem</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {tabela.map((n) => (
              <tr key={n.percentual} className="border-t border-border">
                <td className="py-2 font-semibold">{n.rotulo}</td>
                <td className="py-2">{n.percentual}%</td>
                <td className="py-2 text-muted-foreground">{n.quando}</td>
                <td className="py-2">{brl(n.precoFinal)}</td>
                <td className={`py-2 ${n.alerta ? "text-destructive" : "text-success"}`}>
                  {brl(n.margemPorAssento)} ({n.margemPercentual.toFixed(0)}%)
                  {n.alerta ? " · margem apertada" : ""}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => setPercentual(n.percentual)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      percentual === n.percentual
                        ? "border-accent bg-accent/15 text-accent-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    Usar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void aplicar()}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
          Publicar promoção de {percentual}%
        </button>
        {vigente > 0 && (
          <button
            onClick={() => void parar()}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            <X className="size-3.5" /> Encerrar promoção vigente ({vigente}%)
          </button>
        )}
      </div>

      {vigente > 0 && (
        <p className="mt-3 rounded-xl bg-success/10 p-3 text-xs text-success">
          Promoção ativa de {vigente}% nesta rota — os passageiros já veem o selo de desconto na
          busca.
        </p>
      )}
    </section>
  );
}
