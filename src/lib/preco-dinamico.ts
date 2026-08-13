/**
 * Preço dinâmico da saída intermunicipal/interestadual.
 *
 * A saída é fechada 60 minutos antes do horário programado de partida. Nesse
 * instante a plataforma conhece quantos assentos foram pré-reservados e qual é
 * o desvio da rota de busca. O valor do assento então é escalonado pela
 * ocupação: quanto menor a lotação, maior o fator aplicado sobre o preço
 * publicado — sempre limitado pela tarifa de exclusividade do veículo.
 */

/** Antecedência do fechamento da saída, em minutos. */
export const ANTECEDENCIA_FECHAMENTO_MIN = 60;

/** Prazo que cada passageiro tem para aceitar e pagar a oferta, em minutos. */
export const PRAZO_OFERTA_MIN = 5;

export interface FaixaOcupacao {
  /** Ocupação mínima da faixa (0 a 1). */
  minima: number;
  fator: number;
  rotulo: string;
}

/** Escalonamento por ocupação (da maior para a menor lotação). */
export const FAIXAS_OCUPACAO: FaixaOcupacao[] = [
  { minima: 0.8, fator: 1.0, rotulo: "Lotação alta (80% ou mais)" },
  { minima: 0.6, fator: 1.15, rotulo: "Ocupação de 60% a 79%" },
  { minima: 0.4, fator: 1.35, rotulo: "Ocupação de 40% a 59%" },
  { minima: 0.2, fator: 1.6, rotulo: "Ocupação de 20% a 39%" },
  { minima: 0, fator: 1.9, rotulo: "Ocupação abaixo de 20%" },
];

const arred = (v: number) => Math.round(v * 100) / 100;

export function ocupacaoDaSaida(assentos: number, capacidade: number): number {
  const cap = Math.max(1, Math.trunc(capacidade) || 1);
  return Math.min(1, Math.max(0, assentos / cap));
}

export function faixaDaOcupacao(ocupacao: number): FaixaOcupacao {
  return FAIXAS_OCUPACAO.find((f) => ocupacao >= f.minima) ?? FAIXAS_OCUPACAO.at(-1)!;
}

export interface EntradaPrecoDinamico {
  /** Preço de assento publicado na saída. */
  precoPublicado: number;
  /** Assentos pré-reservados ainda na fila (inclui os já confirmados). */
  assentosNaSaida: number;
  /** Capacidade do veículo. */
  capacidade: number;
  /** Assentos deste passageiro. */
  assentos: number;
  /** Assentos-equivalentes de bagagem (cobrados a 60% do assento). */
  assentosBagagem?: number;
  /** Taxa do desvio de embarque do próprio passageiro. */
  taxaDesvio?: number;
}

export interface PrecoDinamico {
  ocupacao: number;
  fator: number;
  faixa: string;
  precoAssento: number;
  valorAssentos: number;
  valorBagagem: number;
  taxaDesvio: number;
  /** Base da cobrança (antes da taxa administrativa). */
  base: number;
  /** Teto absoluto: tarifa integral do veículo pelo preço publicado. */
  teto: number;
  limitadoPeloTeto: boolean;
}

/**
 * Calcula a base da cobrança do passageiro na saída fechada. O teto impede que
 * o rateio da ociosidade cobre mais que a tarifa de exclusividade do veículo.
 */
export function precoDinamico(e: EntradaPrecoDinamico): PrecoDinamico {
  const publicado = Math.max(0, Number(e.precoPublicado) || 0);
  const capacidade = Math.max(1, Math.trunc(e.capacidade) || 1);
  const ocupacao = ocupacaoDaSaida(e.assentosNaSaida, capacidade);
  const faixa = faixaDaOcupacao(ocupacao);

  const precoAssento = arred(publicado * faixa.fator);
  const assentos = Math.max(1, Math.trunc(e.assentos) || 1);
  const bagagem = Math.max(0, Math.trunc(e.assentosBagagem ?? 0));
  const taxaDesvio = arred(Math.max(0, Number(e.taxaDesvio ?? 0) || 0));

  const valorAssentos = arred(precoAssento * assentos);
  const valorBagagem = arred(precoAssento * 0.6 * bagagem);

  const teto = arred(publicado * capacidade);
  const bruta = arred(valorAssentos + valorBagagem + taxaDesvio);
  const base = arred(Math.min(bruta, teto));

  return {
    ocupacao: Number(ocupacao.toFixed(3)),
    fator: faixa.fator,
    faixa: faixa.rotulo,
    precoAssento,
    valorAssentos,
    valorBagagem,
    taxaDesvio,
    base,
    teto,
    limitadoPeloTeto: bruta > teto,
  };
}

/** Faixa estimada mostrada na pré-reserva (do melhor ao pior cenário). */
export function faixaEstimada(precoPublicado: number, assentos = 1) {
  const publicado = Math.max(0, Number(precoPublicado) || 0);
  const minimo = arred(publicado * FAIXAS_OCUPACAO[0]!.fator * assentos);
  const maximo = arred(publicado * FAIXAS_OCUPACAO.at(-1)!.fator * assentos);
  return { minimo, maximo };
}

/** Momento em que a saída será fechada (60 min antes da partida). */
export function momentoFechamento(partida: Date): Date {
  return new Date(partida.getTime() - ANTECEDENCIA_FECHAMENTO_MIN * 60_000);
}
