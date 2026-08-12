/**
 * Núcleo de cálculo do RotaCerta — bagagem, lotação e precificação regional.
 * Todas as equações são determinísticas e auditáveis; a camada de IA apenas
 * calibra os coeficientes (k_região, fator de dificuldade) a partir dos dados
 * dos primeiros motoristas cadastrados.
 */

export type ClasseVeiculo = "passageiro" | "utilitario_pequeno" | "utilitario_medio" | "utilitario_grande";

export interface Veiculo {
  id: string;
  modelo: string;
  ano: number;
  classe: ClasseVeiculo;
  assentos: number;
  /** Volume útil do bagageiro em litros (L) */
  volumeBagageiroL: number;
  /** Carga útil homologada em kg */
  cargaUtilKg: number;
}

/** Ano mínimo de fabricação aceito: no máximo 10 anos de uso. */
export const anoMinimoPermitido = (anoVigente = new Date().getFullYear()) => anoVigente - 10;

export const veiculoElegivel = (ano: number, anoVigente = new Date().getFullYear()) =>
  ano >= anoMinimoPermitido(anoVigente);

/* ------------------------------------------------------------------ */
/* 1. Volume de bagagem                                                */
/* ------------------------------------------------------------------ */

export interface Volume {
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  pesoKg: number;
  quantidade: number;
}

/**
 * V = Σ (c · l · a / 1000) · q  → litros
 * Aplica-se o fator de empacotamento η = 0,82 (perda por formato irregular),
 * conforme prática de carregamento em bagageiros de teto e porta-malas.
 */
export const FATOR_EMPACOTAMENTO = 0.82;

export function volumeTotalL(volumes: Volume[]): number {
  const bruto = volumes.reduce(
    (acc, v) => acc + ((v.comprimentoCm * v.larguraCm * v.alturaCm) / 1000) * v.quantidade,
    0,
  );
  return bruto / FATOR_EMPACOTAMENTO;
}

export function pesoTotalKg(volumes: Volume[]): number {
  return volumes.reduce((acc, v) => acc + v.pesoKg * v.quantidade, 0);
}

/** Bagagem de mão franqueada por assento (padrão da plataforma). */
export const FRANQUIA_MAO_L = 45;
export const FRANQUIA_MAO_KG = 10;

export interface AvaliacaoBagagem {
  volumeL: number;
  pesoKg: number;
  /** Assentos-equivalente consumidos pela bagagem excedente */
  assentosEquivalentes: number;
  ocupacaoBagageiro: number;
  excedeVeiculo: boolean;
  recomendacao: ClasseVeiculo;
  mensagem: string;
}

/**
 * Assentos-equivalente:
 *   A = teto( max( (V − F_v) / F_v , (P − F_p) / F_p ) )
 * ou seja, cada múltiplo da franquia excedente ocupa um assento adicional.
 */
export function avaliarBagagem(volumes: Volume[], veiculo: Veiculo): AvaliacaoBagagem {
  const volumeL = volumeTotalL(volumes);
  const pesoKg = pesoTotalKg(volumes);

  const excedenteVol = Math.max(0, volumeL - FRANQUIA_MAO_L) / FRANQUIA_MAO_L;
  const excedentePeso = Math.max(0, pesoKg - FRANQUIA_MAO_KG) / FRANQUIA_MAO_KG;
  const assentosEquivalentes = Math.ceil(Math.max(excedenteVol, excedentePeso));

  const ocupacaoBagageiro = volumeL / veiculo.volumeBagageiroL;
  const excedeVeiculo = volumeL > veiculo.volumeBagageiroL || pesoKg > veiculo.cargaUtilKg;

  const recomendacao: ClasseVeiculo =
    volumeL <= FRANQUIA_MAO_L
      ? "passageiro"
      : volumeL <= 400
        ? "utilitario_pequeno"
        : volumeL <= 1200
          ? "utilitario_medio"
          : "utilitario_grande";

  const mensagem = excedeVeiculo
    ? `Volume acima da capacidade deste veículo. Recomendamos ${rotuloClasse(recomendacao)}.`
    : assentosEquivalentes > 0
      ? `Bagagem excedente equivale a ${assentosEquivalentes} assento(s) adicional(is).`
      : "Dentro da franquia de bagagem de mão — sem custo adicional.";

  return { volumeL, pesoKg, assentosEquivalentes, ocupacaoBagageiro, excedeVeiculo, recomendacao, mensagem };
}

export const rotuloClasse = (c: ClasseVeiculo) =>
  ({
    passageiro: "veículo de passageiros",
    utilitario_pequeno: "utilitário de pequeno porte",
    utilitario_medio: "utilitário de médio porte",
    utilitario_grande: "utilitário de grande porte",
  })[c];

/* ------------------------------------------------------------------ */
/* 2. Precificação regional calibrada por IA                           */
/* ------------------------------------------------------------------ */

export interface ParametrosRota {
  distanciaKm: number;
  /** 0 = asfalto pleno · 1 = ramal de terra / travessia de balsa */
  dificuldadeVia: number;
  /** Preço médio do combustível na sede de origem (R$/L) */
  precoCombustivel: number;
  /** Consumo médio do veículo (km/L) */
  consumoKmL: number;
  assentos: number;
  /** Taxa de ocupação histórica observada (0–1) */
  ocupacaoMedia: number;
  /** Nº de travessias de balsa / pedágios no trecho */
  travessias: number;
}

export interface Tarifa {
  custoOperacional: number;
  precoAssento: number;
  precoAssentoBagagem: number;
  faixaMin: number;
  faixaMax: number;
  detalhe: string;
}

/**
 * Custo operacional da viagem:
 *   C = D·(Pc/Kc) + D·Cm·(1 + β·δ) + T·Ct + Cf
 * Preço por assento:
 *   Pa = C / (N · ρ) · (1 + m)
 * onde β = 0,65 (sobrecusto de manutenção em via não pavimentada),
 * Cm = R$ 0,62/km (manutenção + pneus + depreciação),
 * Ct = R$ 18 por travessia, Cf = R$ 45 (custo fixo diário rateado),
 * m = 0,22 (margem do motorista + taxa da plataforma).
 */
export function calcularTarifa(p: ParametrosRota): Tarifa {
  const BETA = 0.65;
  const CUSTO_MANUT_KM = 0.62;
  const CUSTO_TRAVESSIA = 18;
  const CUSTO_FIXO = 45;
  const MARGEM = 0.22;

  const combustivel = p.distanciaKm * (p.precoCombustivel / p.consumoKmL);
  const manutencao = p.distanciaKm * CUSTO_MANUT_KM * (1 + BETA * p.dificuldadeVia);
  const travessias = p.travessias * CUSTO_TRAVESSIA;
  const custoOperacional = combustivel + manutencao + travessias + CUSTO_FIXO;

  const ocupacao = Math.max(0.35, Math.min(1, p.ocupacaoMedia));
  const precoAssento = (custoOperacional / (p.assentos * ocupacao)) * (1 + MARGEM);

  return {
    custoOperacional,
    precoAssento,
    precoAssentoBagagem: precoAssento * 0.6,
    faixaMin: precoAssento * 0.9,
    faixaMax: precoAssento * 1.18,
    detalhe: `Combustível R$ ${combustivel.toFixed(2)} · Manutenção R$ ${manutencao.toFixed(2)} · Travessias R$ ${travessias.toFixed(2)} · Fixo R$ ${CUSTO_FIXO.toFixed(2)}`,
  };
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ------------------------------------------------------------------ */
/* 3. Exclusividade da saída (fretamento do veículo inteiro)           */
/* ------------------------------------------------------------------ */

/** Franquia de bagagem quando o passageiro reserva a rota com exclusividade. */
export const FRANQUIA_EXCLUSIVA_KG = 40;
/** Valor cobrado por quilo acima da franquia exclusiva. */
export const PRECO_KG_EXCEDENTE = 3.5;

/** Peso acima da franquia de 40 kg, arredondado para o quilo cheio. */
export const pesoExcedenteKg = (pesoKg: number) =>
  Math.max(0, Math.ceil(pesoKg - FRANQUIA_EXCLUSIVA_KG));

/** Custo do peso excedente na reserva exclusiva. */
export const custoPesoExcedente = (pesoKg: number) =>
  pesoExcedenteKg(pesoKg) * PRECO_KG_EXCEDENTE;
