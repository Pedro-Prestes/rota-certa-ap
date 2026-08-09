/**
 * Tipos e utilitários do módulo contábil (compartilhados entre cliente e servidor).
 */
import type { ConfigTaxa } from "./taxas";

export interface PeriodoContabil {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
}

export interface EstornoResumo {
  id: string;
  valor: number;
  integral: boolean;
  devolve_taxa: boolean;
  motivo: string;
  status: string;
  provedor: string | null;
  provedor_ref: string | null;
  created_at: string;
}

export interface LancamentoResumo {
  id: string;
  tipo: string;
  valor: number;
  descricao: string;
  competencia: string;
  created_at: string;
  corrida_id: string | null;
  pagamento_id: string | null;
  detalhamento: Record<string, string | number | boolean | null> | null;
}

export interface TransacaoContabil {
  id: string;
  pago_em: string;
  competencia: string;
  forma: string;
  status: string;
  parcelas: number;
  bandeira: string | null;
  autorizacao: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  clienteId: string;
  clienteNome: string;
  clienteContato: string | null;
  clienteCurto: string;
  corridaId: string | null;
  rota: string;
  dataCorrida: string | null;
  motorista: string;
  veiculo: string | null;
  assentos: number;
  base: number;
  taxaPercentual: number;
  taxaVariavel: number;
  taxaFixa: number;
  taxaAdministrativa: number;
  total: number;
  taxaGateway: number;
  repasseMotorista: number;
  estornado: number;
  liquidoPlataforma: number;
  estornos: EstornoResumo[];
  lancamentos: LancamentoResumo[];
}

export interface RepasseContabil {
  id: string;
  motoristaId: string;
  motoristaNome: string;
  bruto: number;
  taxaRetida: number;
  valor: number;
  taxa: number;
  liquido: number;
  metodo: string;
  modo: string;
  status: string;
  provedor: string | null;
  referencia: string | null;
  solicitado_em: string;
  processado_em: string | null;
}

export interface CobrancaPixContabil {
  id: string;
  criado_em: string;
  clienteNome: string;
  finalidade: string;
  descricao: string;
  valorBase: number;
  taxaAdmin: number;
  valorTotal: number;
  creditos: number;
  status: string;
  provedor: string;
  referencia: string | null;
  environment: string;
}

export interface LinhaCompetencia {
  competencia: string;
  receita: number;
  taxaPlataforma: number;
  taxaGateway: number;
  repasse: number;
  estorno: number;
  custos: number;
  resultado: number;
}

export interface CustoContabil {
  id: string;
  fornecedor: string;
  categoria: string;
  descricao: string;
  valor: number;
  competencia: string;
  recorrente: boolean;
}

export interface ResumoContabil {
  periodo: PeriodoContabil;
  config: ConfigTaxa;
  totais: {
    transacoes: number;
    base: number;
    taxaAdministrativa: number;
    total: number;
    taxaGateway: number;
    repasse: number;
    estornado: number;
    custos: number;
    resultado: number;
    ticketMedio: number;
  };
  porForma: { forma: string; quantidade: number; total: number; taxaAdministrativa: number }[];
  transacoes: TransacaoContabil[];
  repasses: RepasseContabil[];
  cobrancasPix: CobrancaPixContabil[];
  custos: CustoContabil[];
  competencias: LinhaCompetencia[];
}

/* ---------------------------------------------------------------- períodos */

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type AtalhoPeriodo = "mes" | "anterior" | "90dias" | "ano" | "custom";

export const ATALHOS: { id: AtalhoPeriodo; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês atual" },
  { id: "anterior", rotulo: "Mês anterior" },
  { id: "90dias", rotulo: "Últimos 90 dias" },
  { id: "ano", rotulo: "Ano atual" },
  { id: "custom", rotulo: "Personalizado" },
];

export function periodoDoAtalho(atalho: AtalhoPeriodo, hoje = new Date()): PeriodoContabil {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if (atalho === "anterior") {
    return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
  }
  if (atalho === "90dias") {
    const de = new Date(hoje);
    de.setDate(de.getDate() - 89);
    return { de: iso(de), ate: iso(hoje) };
  }
  if (atalho === "ano") {
    return { de: iso(new Date(y, 0, 1)), ate: iso(new Date(y, 11, 31)) };
  }
  return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) };
}

export const rotuloCompetencia = (comp: string) => {
  const [ano, mes] = comp.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
};

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const ROTULO_FORMA: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  dinheiro: "Espécie",
};

export const ROTULO_FINALIDADE: Record<string, string> = {
  credito_carteira: "Crédito de carteira",
  assinatura: "Assinatura",
  corrida: "Corrida avulsa",
  protecao: "Proteção RotaCerta",
};

/* -------------------------------------------------------------------- CSV */

const celula = (v: unknown) => {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
};

export function gerarCsv(colunas: string[], linhas: (string | number)[][]): string {
  return [colunas, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
}

export function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvTransacoes(transacoes: TransacaoContabil[]): string {
  return gerarCsv(
    [
      "Data",
      "Cliente",
      "ID da conta",
      "Rota",
      "Motorista",
      "Meio",
      "Status",
      "Base da corrida",
      "Taxa administrativa",
      "Total cobrado",
      "Tarifa do gateway",
      "Repasse ao motorista",
      "Estornado",
      "Líquido da plataforma",
    ],
    transacoes.map((t) => [
      dataHora(t.pago_em),
      t.clienteNome,
      t.clienteCurto,
      t.rota,
      t.motorista,
      ROTULO_FORMA[t.forma] ?? t.forma,
      t.status,
      t.base.toFixed(2).replace(".", ","),
      t.taxaAdministrativa.toFixed(2).replace(".", ","),
      t.total.toFixed(2).replace(".", ","),
      t.taxaGateway.toFixed(2).replace(".", ","),
      t.repasseMotorista.toFixed(2).replace(".", ","),
      t.estornado.toFixed(2).replace(".", ","),
      t.liquidoPlataforma.toFixed(2).replace(".", ","),
    ]),
  );
}

export function csvCompetencias(linhas: LinhaCompetencia[]): string {
  return gerarCsv(
    [
      "Competência",
      "Receita bruta",
      "Taxa administrativa",
      "Tarifas do gateway",
      "Repasses",
      "Estornos",
      "Custos de terceiros",
      "Resultado",
    ],
    linhas.map((l) => [
      l.competencia,
      l.receita.toFixed(2).replace(".", ","),
      l.taxaPlataforma.toFixed(2).replace(".", ","),
      l.taxaGateway.toFixed(2).replace(".", ","),
      l.repasse.toFixed(2).replace(".", ","),
      l.estorno.toFixed(2).replace(".", ","),
      l.custos.toFixed(2).replace(".", ","),
      l.resultado.toFixed(2).replace(".", ","),
    ]),
  );
}
