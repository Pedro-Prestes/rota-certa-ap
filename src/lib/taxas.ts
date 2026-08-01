/**
 * Composição da cobrança do RotaViva.
 *
 * O valor cobrado do passageiro é sempre:
 *   Total = Base da corrida + Taxa administrativa
 *   Taxa administrativa = Base · (p/100) + F
 *
 * A taxa administrativa custeia os serviços de terceiros necessários à
 * manutenção automatizada da plataforma (gateway de pagamento, telefonia/SMS,
 * hospedagem, consultas de idoneidade e registro em cadeia de blocos) e é
 * demonstrada, item a item, na área contábil.
 */

export interface ConfigTaxa {
  chave: string;
  taxa_percentual: number;
  taxa_fixa: number;
  repasse_motorista_percentual: number;
  descricao?: string;
}

export const CONFIG_PADRAO: ConfigTaxa = {
  chave: "padrao",
  taxa_percentual: 12,
  taxa_fixa: 1.5,
  repasse_motorista_percentual: 85,
  descricao: "Taxa administrativa padrão da plataforma",
};

export interface ItemComposicao {
  rotulo: string;
  valor: number;
}

export interface ComposicaoCobranca {
  base: number;
  taxaPercentualAplicada: number;
  taxaVariavel: number;
  taxaFixa: number;
  taxaAdministrativa: number;
  total: number;
  totalCentavos: number;
  repasseMotorista: number;
  itens: ItemComposicao[];
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function comporCobranca(base: number, cfg: ConfigTaxa = CONFIG_PADRAO): ComposicaoCobranca {
  const seguro = Math.max(0, Number(base) || 0);
  const taxaVariavel = arred((seguro * Number(cfg.taxa_percentual || 0)) / 100);
  const taxaFixa = arred(Number(cfg.taxa_fixa || 0));
  const taxaAdministrativa = arred(taxaVariavel + taxaFixa);
  const total = arred(seguro + taxaAdministrativa);
  const repasseMotorista = arred((seguro * Number(cfg.repasse_motorista_percentual || 0)) / 100);

  return {
    base: seguro,
    taxaPercentualAplicada: Number(cfg.taxa_percentual || 0),
    taxaVariavel,
    taxaFixa,
    taxaAdministrativa,
    total,
    totalCentavos: Math.round(total * 100),
    repasseMotorista,
    itens: [
      { rotulo: "Serviço de transporte (base)", valor: seguro },
      { rotulo: `Taxa administrativa variável (${cfg.taxa_percentual}%)`, valor: taxaVariavel },
      { rotulo: "Taxa administrativa fixa por transação", valor: taxaFixa },
      { rotulo: "Total cobrado do passageiro", valor: total },
    ],
  };
}

/** Categorias de custo de terceiros demonstradas na área contábil. */
export const CATEGORIAS_CUSTO = [
  { id: "gateway", rotulo: "Gateway de pagamento" },
  { id: "telefonia", rotulo: "Telefonia / SMS" },
  { id: "infraestrutura", rotulo: "Hospedagem e infraestrutura" },
  { id: "idoneidade", rotulo: "Consultas de idoneidade" },
  { id: "blockchain", rotulo: "Registro em cadeia de blocos" },
  { id: "contabil", rotulo: "Contabilidade e tributos" },
  { id: "outros", rotulo: "Outros serviços" },
] as const;

export const rotuloCategoria = (id: string) =>
  CATEGORIAS_CUSTO.find((c) => c.id === id)?.rotulo ?? id;

export const TIPOS_LANCAMENTO = [
  { id: "receita_bruta", rotulo: "Receita bruta", sinal: 1 },
  { id: "taxa_plataforma", rotulo: "Taxa administrativa", sinal: 1 },
  { id: "taxa_gateway", rotulo: "Taxa do gateway", sinal: -1 },
  { id: "repasse_motorista", rotulo: "Repasse ao motorista", sinal: -1 },
  { id: "estorno", rotulo: "Estorno", sinal: -1 },
  { id: "custo_terceiro", rotulo: "Custo de terceiros", sinal: -1 },
  { id: "ajuste", rotulo: "Ajuste", sinal: 1 },
] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number]["id"];

export const rotuloTipo = (id: string) => TIPOS_LANCAMENTO.find((t) => t.id === id)?.rotulo ?? id;
export const sinalTipo = (id: string) => TIPOS_LANCAMENTO.find((t) => t.id === id)?.sinal ?? 1;
