/**
 * Desconto promocional publicado pelo motorista (ou frotista) em uma rota.
 *
 * O motorista escolhe um nível da tabela sugerida; o percentual incide sobre o
 * valor dos assentos (nunca sobre a taxa administrativa) e é limitado a 25%
 * para preservar a margem operacional da saída. A viagem de ida e volta ganha
 * ainda um desconto padrão no trecho de retorno, porque o veículo já faria o
 * caminho de volta.
 */

/** Trecho ao qual o desconto se aplica. */
export type TrechoDesconto = "ida" | "volta" | "ambos";

/** Trecho de uma reserva. */
export type Trecho = "ida" | "volta";

/** Teto de desconto permitido pela plataforma, em %. */
export const LIMITE_DESCONTO = 25;

/** Desconto padrão aplicado ao trecho de retorno na viagem de ida e volta. */
export const DESCONTO_RETORNO_PADRAO = 5;

export interface NivelDesconto {
  percentual: number;
  rotulo: string;
  quando: string;
}

/** Tabela sugerida ao motorista, do mais conservador ao mais agressivo. */
export const NIVEIS_DESCONTO: NivelDesconto[] = [
  { percentual: 5, rotulo: "Leve", quando: "Encher os últimos assentos" },
  { percentual: 10, rotulo: "Atrativo", quando: "Saída com ocupação média" },
  { percentual: 15, rotulo: "Forte", quando: "Saída com baixa procura" },
  { percentual: 20, rotulo: "Agressivo", quando: "Última hora, evitar saída vazia" },
  { percentual: 25, rotulo: "Limite", quando: "Máximo permitido — margem apertada" },
];

export interface DescontoRota {
  id: string;
  rota_id: string;
  percentual: number;
  trecho: TrechoDesconto;
  inicio: string;
  fim: string | null;
  ativo: boolean;
  observacao?: string | null;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export const percentualValido = (p: number) =>
  Number.isFinite(p) && p > 0 && p <= LIMITE_DESCONTO;

/** Desconto vigente para o trecho, considerando validade e o maior percentual. */
export function descontoVigente(
  descontos: DescontoRota[] | null | undefined,
  trecho: Trecho,
  agora: Date = new Date(),
): number {
  const t = agora.getTime();
  const validos = (descontos ?? []).filter(
    (d) =>
      d.ativo &&
      (d.trecho === "ambos" || d.trecho === trecho) &&
      new Date(d.inicio).getTime() <= t &&
      (!d.fim || new Date(d.fim).getTime() > t),
  );
  if (validos.length === 0) return 0;
  return Math.min(LIMITE_DESCONTO, Math.max(...validos.map((d) => Number(d.percentual) || 0)));
}

/** Aplica o percentual de desconto a um valor. */
export const aplicarDesconto = (valor: number, percentual: number) =>
  arred(valor * (1 - Math.min(LIMITE_DESCONTO, Math.max(0, percentual)) / 100));

/** Valor economizado pelo passageiro. */
export const economiaDesconto = (valor: number, percentual: number) =>
  arred(valor - aplicarDesconto(valor, percentual));

export interface MargemNivel extends NivelDesconto {
  precoFinal: number;
  receitaPorSaida: number;
  margemPorAssento: number;
  margemPercentual: number;
  alerta: boolean;
}

export interface EntradaMargem {
  precoAssento: number;
  distanciaKm: number;
  assentos: number;
  precoCombustivel: number;
  consumoKmL: number;
}

/** Custo operacional estimado por assento (combustível do trecho A → B). */
export function custoPorAssento(e: EntradaMargem): number {
  const assentos = Math.max(1, Math.trunc(e.assentos) || 1);
  const litros = Math.max(0, e.distanciaKm) / Math.max(1, e.consumoKmL);
  return arred((litros * e.precoCombustivel) / assentos);
}

/** Tabela de descontos com o preço final e a margem estimada de cada nível. */
export function tabelaDescontos(e: EntradaMargem): MargemNivel[] {
  const custo = custoPorAssento(e);
  return NIVEIS_DESCONTO.map((n) => {
    const precoFinal = aplicarDesconto(e.precoAssento, n.percentual);
    const margemPorAssento = arred(precoFinal - custo);
    return {
      ...n,
      precoFinal,
      receitaPorSaida: arred(precoFinal * Math.max(1, e.assentos)),
      margemPorAssento,
      margemPercentual: precoFinal > 0 ? arred((margemPorAssento / precoFinal) * 100) : 0,
      alerta: margemPorAssento <= custo * 0.2,
    };
  });
}
