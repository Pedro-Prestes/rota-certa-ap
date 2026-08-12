/**
 * Composição da cobrança do RotaCerta.
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
  /** Pontos percentuais da taxa administrativa destinados à cooperativa (padrão 3). */
  rateio_cooperativa_percentual?: number;
  descricao?: string;
}

export const CONFIG_PADRAO: ConfigTaxa = {
  chave: "padrao",
  taxa_percentual: 12,
  taxa_fixa: 1.5,
  repasse_motorista_percentual: 85,
  rateio_cooperativa_percentual: 3,
  descricao: "Taxa administrativa padrão da plataforma",
};

/** Pontos percentuais padrão destinados à cooperativa cadastrada. */
export const RATEIO_COOPERATIVA_PADRAO = 3;


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

/* -------------------------------------------- rateio com cooperativas */

export interface RateioTaxa {
  /** Taxa administrativa total cobrada na transação. */
  taxaAdministrativa: number;
  /** Pontos percentuais destinados à cooperativa (0 quando não há vínculo). */
  percentualCooperativa: number;
  /** Parcela da taxa que fica com a plataforma. */
  parcelaPlataforma: number;
  /** Parcela da taxa destinada à cooperativa vinculada ao motorista. */
  parcelaCooperativa: number;
}

/**
 * Particiona a taxa administrativa entre a plataforma e a cooperativa do
 * motorista. Com a configuração padrão (12% + fixa, rateio de 3 p.p.), a
 * cooperativa recebe 3% da base da corrida e a plataforma fica com o restante.
 * Sem vínculo com cooperativa, a taxa é integralmente da plataforma.
 */
export function ratearTaxa(
  base: number,
  taxaAdministrativa: number,
  cfg: ConfigTaxa = CONFIG_PADRAO,
  temCooperativa = false,
): RateioTaxa {
  const taxa = arred(Math.max(0, Number(taxaAdministrativa) || 0));
  const pp = temCooperativa
    ? Math.max(0, Number(cfg.rateio_cooperativa_percentual ?? RATEIO_COOPERATIVA_PADRAO) || 0)
    : 0;
  const bruta = arred((Math.max(0, Number(base) || 0) * pp) / 100);
  const parcelaCooperativa = arred(Math.min(bruta, taxa));
  return {
    taxaAdministrativa: taxa,
    percentualCooperativa: pp,
    parcelaCooperativa,
    parcelaPlataforma: arred(taxa - parcelaCooperativa),
  };
}
