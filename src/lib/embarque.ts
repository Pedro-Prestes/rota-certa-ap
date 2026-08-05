/**
 * Núcleo de planejamento da "rota de busca" (pickup) do RotaCerta.
 *
 * Metodologia
 * -----------
 * A prática cultural do transporte intermunicipal do Amapá é o motorista
 * apanhar cada passageiro num ponto combinado. A plataforma formaliza esse
 * acordo (proposta do passageiro → aceite ou contraproposta do motorista) e,
 * a partir dos pontos ACEITOS, resolve um caminho aberto:
 *
 *     garagem/base do motorista → p1 → p2 → ... → pn → saída da cidade
 *
 * O caminho é otimizado (vizinho mais próximo + 2-opt) sobre a matriz de
 * tempos. Com o tempo total da busca, o horário de partida programado da
 * viagem é preservado por retropropagação:
 *
 *     t_saida_motorista = t_partida − (Σ trechos + n·τ_parada + folga)
 *     eta(pk)           = t_saida_motorista + Σ_{i<=k} trecho_i + (k−1)·τ_parada
 *
 * Assim o horário de saída anunciado na plataforma é garantido, e cada
 * passageiro recebe o ETA do seu ponto.
 */

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface PontoBusca extends Coordenada {
  id: string;
  rotulo: string;
  assentos: number;
}

/** Tempo de embarque por ponto (bagagem + acomodação), em minutos. */
export const PARADA_MIN = 3;
/** Folga operacional aplicada antes da partida programada, em minutos. */
export const FOLGA_MIN = 10;
/** Velocidade média de deslocamento urbano/ramal para o modo geométrico. */
export const VELOCIDADE_BUSCA_KMH = 27;
/** Custo de manutenção/depreciação por km rodado na busca (R$). */
export const CUSTO_MANUT_KM = 0.62;

const R_TERRA_KM = 6371;

export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Fator de sinuosidade viária aplicado sobre a distância geodésica. */
export const FATOR_VIARIO = 1.28;

export interface Matriz {
  /** distância em km entre índices i e j */
  km: number[][];
  /** duração em minutos entre índices i e j */
  min: number[][];
}

/** Matriz estimada geometricamente — usada quando o provedor externo falha. */
export function matrizGeometrica(pontos: Coordenada[]): Matriz {
  const n = pontos.length;
  const km: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  const min: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const d = distanciaKm(pontos[i]!, pontos[j]!) * FATOR_VIARIO;
      km[i]![j] = d;
      min[i]![j] = (d / VELOCIDADE_BUSCA_KMH) * 60;
    }
  }
  return { km, min };
}

const custoCaminho = (ordem: number[], m: Matriz, origem: number, destino: number) => {
  const seq = [origem, ...ordem, destino];
  let total = 0;
  for (let i = 0; i < seq.length - 1; i += 1) total += m.min[seq[i]!]![seq[i + 1]!]!;
  return total;
};

/**
 * Caminho aberto ótimo (heurística): vizinho mais próximo seguido de 2-opt
 * até convergir. Índice 0 = base do motorista, índice n+1 = saída da cidade.
 */
export function otimizarOrdem(m: Matriz, origem: number, destino: number, intermediarios: number[]) {
  let ordem: number[] = [];
  const restantes = [...intermediarios];
  let atual = origem;
  while (restantes.length > 0) {
    let melhor = 0;
    for (let i = 1; i < restantes.length; i += 1) {
      if (m.min[atual]![restantes[i]!]! < m.min[atual]![restantes[melhor]!]!) melhor = i;
    }
    atual = restantes.splice(melhor, 1)[0]!;
    ordem.push(atual);
  }

  let melhorou = true;
  while (melhorou) {
    melhorou = false;
    for (let i = 0; i < ordem.length - 1; i += 1) {
      for (let j = i + 1; j < ordem.length; j += 1) {
        const candidato = [...ordem.slice(0, i), ...ordem.slice(i, j + 1).reverse(), ...ordem.slice(j + 1)];
        if (custoCaminho(candidato, m, origem, destino) + 1e-9 < custoCaminho(ordem, m, origem, destino)) {
          ordem = candidato;
          melhorou = true;
        }
      }
    }
  }
  return ordem;
}

export interface ParadaPlanejada {
  pontoId: string;
  rotulo: string;
  ordem: number;
  assentos: number;
  distanciaTrechoKm: number;
  duracaoTrechoMin: number;
  eta: string;
}

export interface PlanoBusca {
  distanciaKm: number;
  duracaoMin: number;
  custo: number;
  saidaMotorista: string;
  partidaGarantida: string;
  paradas: ParadaPlanejada[];
  provedor: string;
}

export interface EntradaPlano {
  base: Coordenada;
  saidaCidade: Coordenada;
  pontos: PontoBusca[];
  /** Horário programado de partida da viagem (ISO). */
  partida: Date;
  precoCombustivel: number;
  consumoKmL: number;
  matriz?: Matriz;
  /** Ordem já otimizada pelo provedor externo (índices de `pontos`). */
  ordemProvedor?: number[];
  provedor?: string;
}

/**
 * Monta o plano completo: sequência otimizada, ETA de cada ponto, horário de
 * saída do motorista e custo adicional da busca.
 */
export function planejarBusca(e: EntradaPlano): PlanoBusca {
  const nos: Coordenada[] = [e.base, ...e.pontos, e.saidaCidade];
  const m = e.matriz ?? matrizGeometrica(nos);
  const destino = nos.length - 1;
  const intermediarios = e.pontos.map((_, i) => i + 1);
  const ordem =
    e.ordemProvedor && e.ordemProvedor.length === e.pontos.length
      ? e.ordemProvedor.map((i) => i + 1)
      : otimizarOrdem(m, 0, destino, intermediarios);

  const seq = [0, ...ordem, destino];
  let km = 0;
  let minutos = 0;
  const trechos = seq.slice(1).map((no, i) => {
    const de = seq[i]!;
    km += m.km[de]![no]!;
    minutos += m.min[de]![no]!;
    return { no, km: m.km[de]![no]!, min: m.min[de]![no]! };
  });

  const paradasCount = ordem.length;
  const duracaoMin = Math.round(minutos + paradasCount * PARADA_MIN);
  const saida = new Date(e.partida.getTime() - (duracaoMin + FOLGA_MIN) * 60_000);

  let acumulado = 0;
  const paradas: ParadaPlanejada[] = [];
  trechos.forEach((t, i) => {
    if (t.no === destino) return;
    acumulado += t.min + (i > 0 ? PARADA_MIN : 0);
    const ponto = e.pontos[t.no - 1]!;
    paradas.push({
      pontoId: ponto.id,
      rotulo: ponto.rotulo,
      ordem: i + 1,
      assentos: ponto.assentos,
      distanciaTrechoKm: Number(t.km.toFixed(2)),
      duracaoTrechoMin: Math.round(t.min),
      eta: new Date(saida.getTime() + acumulado * 60_000).toISOString(),
    });
  });

  const custo = km * (e.precoCombustivel / e.consumoKmL + CUSTO_MANUT_KM);

  return {
    distanciaKm: Number(km.toFixed(2)),
    duracaoMin,
    custo: Number(custo.toFixed(2)),
    saidaMotorista: saida.toISOString(),
    partidaGarantida: e.partida.toISOString(),
    paradas,
    provedor: e.provedor ?? "geometrico",
  };
}

export const STATUS_PONTO = {
  proposto: "Aguardando o motorista",
  aceito: "Ponto acordado",
  contraproposta: "Contraproposta do motorista",
  recusado: "Recusado",
  cancelado: "Cancelado",
} as const;

export type StatusPonto = keyof typeof STATUS_PONTO;

export const COR_STATUS_PONTO: Record<StatusPonto, string> = {
  proposto: "bg-accent/15 text-accent-foreground",
  aceito: "bg-success/10 text-success",
  contraproposta: "bg-primary/10 text-primary",
  recusado: "bg-destructive/10 text-destructive",
  cancelado: "bg-secondary text-muted-foreground",
};

export const horaLocal = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
