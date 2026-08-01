import { brl } from "./logistica";

export type FormaPagamento = "pix" | "credito" | "debito" | "dinheiro";
export type StatusPagamento = "pendente" | "pago" | "estornado" | "cancelado";

export const FORMAS: { id: FormaPagamento; rotulo: string; taxaPadrao: number }[] = [
  { id: "pix", rotulo: "Pix", taxaPadrao: 0.99 },
  { id: "debito", rotulo: "Cartão de débito", taxaPadrao: 1.99 },
  { id: "credito", rotulo: "Cartão de crédito", taxaPadrao: 3.49 },
  { id: "dinheiro", rotulo: "Dinheiro", taxaPadrao: 0 },
];

export const STATUS: { id: StatusPagamento; rotulo: string }[] = [
  { id: "pago", rotulo: "Pago" },
  { id: "pendente", rotulo: "Pendente" },
  { id: "estornado", rotulo: "Estornado" },
  { id: "cancelado", rotulo: "Cancelado" },
];

export const rotuloForma = (f: FormaPagamento) => FORMAS.find((x) => x.id === f)?.rotulo ?? f;
export const rotuloStatus = (s: StatusPagamento) => STATUS.find((x) => x.id === s)?.rotulo ?? s;

/** Acréscimo por parcela adicional no crédito parcelado (a.m.). */
export const JUROS_PARCELA = 1.5;

export function taxaSugerida(forma: FormaPagamento, parcelas = 1): number {
  const base = FORMAS.find((f) => f.id === forma)?.taxaPadrao ?? 0;
  if (forma !== "credito") return base;
  return Number((base + Math.max(0, parcelas - 1) * JUROS_PARCELA).toFixed(2));
}

export interface Corrida {
  id: string;
  passageiro_nome: string;
  motorista_nome: string;
  veiculo: string | null;
  origem: string;
  destino: string;
  data_corrida: string;
  hora_partida: string | null;
  hora_chegada: string | null;
  distancia_km: number;
  assentos: number;
  bagagem_l: number;
  valor_tarifa: number;
  valor_bagagem: number;
  valor_pedagios: number;
  valor_extras: number;
  desconto: number;
  comissao_percentual: number;
  observacoes: string | null;
}

export interface Pagamento {
  id: string;
  corrida_id: string;
  forma: FormaPagamento;
  status: StatusPagamento;
  valor: number;
  taxa_percentual: number;
  parcelas: number;
  bandeira: string | null;
  autorizacao: string | null;
  chave_pix: string | null;
  valor_recebido: number | null;
  troco: number;
  pago_em: string;
  observacoes: string | null;
}

export interface ResumoCorrida {
  bruto: number;
  desconto: number;
  total: number;
  recebido: number;
  pendente: number;
  taxas: number;
  comissao: number;
  liquidoMotorista: number;
  saldo: number;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Contabilidade completa de uma corrida a partir dos seus pagamentos. */
export function resumoCorrida(c: Corrida, pagamentos: Pagamento[]): ResumoCorrida {
  const bruto = n(c.valor_tarifa) + n(c.valor_bagagem) + n(c.valor_pedagios) + n(c.valor_extras);
  const total = Math.max(0, bruto - n(c.desconto));

  const validos = pagamentos.filter((p) => p.status === "pago");
  const recebido = validos.reduce((a, p) => a + n(p.valor), 0);
  const taxas = validos.reduce((a, p) => a + (n(p.valor) * n(p.taxa_percentual)) / 100, 0);
  const comissao = ((recebido - taxas) * n(c.comissao_percentual)) / 100;

  return {
    bruto,
    desconto: n(c.desconto),
    total,
    recebido,
    pendente: Math.max(0, total - recebido),
    taxas,
    comissao,
    liquidoMotorista: recebido - taxas - comissao,
    saldo: recebido - total,
  };
}

export function liquidoPagamento(p: Pagamento): number {
  return n(p.valor) - (n(p.valor) * n(p.taxa_percentual)) / 100;
}

export { brl };
