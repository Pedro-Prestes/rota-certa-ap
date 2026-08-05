/**
 * Catálogo de produtos de preço fixo do RotaCerta.
 *
 * - Assinaturas (motorista e passageiro) reduzem a taxa administrativa cobrada
 *   em cada corrida.
 * - Pacotes de créditos são compras únicas que abastecem a carteira do usuário
 *   e abatem corridas futuras.
 *
 * Os identificadores abaixo são os mesmos cadastrados no provedor de pagamento
 * e são estáveis entre os ambientes de teste e de produção.
 */

export type PublicoPlano = "motorista" | "passageiro";
export type Periodicidade = "mensal" | "anual";

export interface PlanoPreco {
  priceId: string;
  periodicidade: Periodicidade;
  valor: number;
  /** Valor mensal equivalente — usado para classificar upgrade x downgrade. */
  valorMensalEquivalente: number;
  rotulo: string;
}

export interface Plano {
  productId: string;
  nome: string;
  publico: PublicoPlano;
  descricao: string;
  beneficios: string[];
  /** Taxa administrativa aplicada às corridas de quem tem o plano ativo. */
  taxa: { taxa_percentual: number; taxa_fixa: number };
  precos: PlanoPreco[];
}

export const PLANOS: Plano[] = [
  {
    productId: "motorista_pro",
    nome: "Motorista Pro",
    publico: "motorista",
    descricao: "Para quem roda todos os dias e quer manter mais da corrida.",
    beneficios: [
      "Taxa administrativa de 6% + R$ 0,50 por corrida",
      "Prioridade na fila de chamados",
      "Relatórios de faturamento e trajetos completos",
      "Renovação de idoneidade sem custo adicional",
    ],
    taxa: { taxa_percentual: 6, taxa_fixa: 0.5 },
    precos: [
      {
        priceId: "motorista_pro_mensal",
        periodicidade: "mensal",
        valor: 49.9,
        valorMensalEquivalente: 49.9,
        rotulo: "R$ 49,90/mês",
      },
      {
        priceId: "motorista_pro_anual",
        periodicidade: "anual",
        valor: 499,
        valorMensalEquivalente: 41.58,
        rotulo: "R$ 499,00/ano",
      },
    ],
  },
  {
    productId: "passageiro_clube",
    nome: "Clube do Passageiro",
    publico: "passageiro",
    descricao: "Vantagens para quem usa a RotaCerta com frequência.",
    beneficios: [
      "Taxa administrativa de 8% + R$ 0,75 por corrida",
      "Prioridade no atendimento e no agendamento",
      "Histórico e comprovantes detalhados",
    ],
    taxa: { taxa_percentual: 8, taxa_fixa: 0.75 },
    precos: [
      {
        priceId: "passageiro_clube_mensal",
        periodicidade: "mensal",
        valor: 19.9,
        valorMensalEquivalente: 19.9,
        rotulo: "R$ 19,90/mês",
      },
      {
        priceId: "passageiro_clube_anual",
        periodicidade: "anual",
        valor: 199,
        valorMensalEquivalente: 16.58,
        rotulo: "R$ 199,00/ano",
      },
    ],
  },
];

export interface PacoteCredito {
  priceId: string;
  valor: number;
  bonus: number;
  rotulo: string;
}

/** Pacotes de créditos pré-pagos (compra única). */
export const PACOTES_CREDITO: PacoteCredito[] = [
  { priceId: "creditos_50", valor: 50, bonus: 0, rotulo: "R$ 50 em créditos" },
  { priceId: "creditos_100", valor: 100, bonus: 5, rotulo: "R$ 100 + R$ 5 de bônus" },
  { priceId: "creditos_200", valor: 200, bonus: 15, rotulo: "R$ 200 + R$ 15 de bônus" },
];

export const PRICE_IDS_ASSINATURA = PLANOS.flatMap((p) => p.precos.map((pr) => pr.priceId));

export function planoDoPrice(priceId: string): Plano | undefined {
  return PLANOS.find((p) => p.precos.some((pr) => pr.priceId === priceId));
}

export function precoPorId(priceId: string): PlanoPreco | undefined {
  for (const plano of PLANOS) {
    const preco = plano.precos.find((pr) => pr.priceId === priceId);
    if (preco) return preco;
  }
  return undefined;
}

export function pacotePorId(priceId: string): PacoteCredito | undefined {
  return PACOTES_CREDITO.find((p) => p.priceId === priceId);
}

export function ehPriceValido(priceId: string): boolean {
  return Boolean(precoPorId(priceId) || pacotePorId(priceId));
}

/** Upgrade quando o novo plano custa mais por mês; downgrade quando custa menos. */
export function classificarTroca(
  priceAtual: string,
  priceNovo: string,
): "upgrade" | "downgrade" | "igual" {
  const atual = precoPorId(priceAtual)?.valorMensalEquivalente ?? 0;
  const novo = precoPorId(priceNovo)?.valorMensalEquivalente ?? 0;
  if (novo > atual) return "upgrade";
  if (novo < atual) return "downgrade";
  return "igual";
}

/** Status considerados com acesso liberado (inclui cancelado até o fim do período pago). */
export function assinaturaAtiva(sub: {
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}): boolean {
  const fim = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const dentroDoPeriodo = fim === null || fim > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return dentroDoPeriodo;
  // Cancelamento agendado: acesso mantido até o fim do período pago.
  if (sub.status === "canceled") return Boolean(sub.cancel_at_period_end) && dentroDoPeriodo;
  return false;
}
