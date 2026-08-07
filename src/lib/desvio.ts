/**
 * Precificação dinâmica do assento pelo desvio gerado (RotaCerta).
 *
 * O passageiro só paga pelo excesso que o seu ponto de apanhe impõe à rota
 * direta do motorista:
 *
 *     Δkm  = max(0, km_com_desvio − km_direto)
 *     Δmin = max(0, min_com_desvio − min_direto)
 *     taxa = Δkm · custo_km + Δmin · custo_min
 *     preço = base + taxa
 */

import { distanciaKm, FATOR_VIARIO, VELOCIDADE_BUSCA_KMH, type Coordenada } from "./embarque";

/** Custo padrão por km excedente (combustível + manutenção). */
export const CUSTO_KM_EXTRA = 1.35;
/** Custo padrão por minuto excedente (tempo do condutor). */
export const CUSTO_MIN_EXTRA = 0.28;

export interface MetricasTrecho {
  distanciaKm: number;
  duracaoMin: number;
}

export interface EntradaDesvio {
  /** Métricas da rota direta: base → destino. */
  direta: MetricasTrecho;
  /** Métricas da rota com desvio: base → apanhe → destino. */
  comDesvio: MetricasTrecho;
  precoBase: number;
  custoKmExtra?: number;
  custoMinExtra?: number;
}

export interface PrecoDesvio {
  precoBase: number;
  taxaDesvio: number;
  precoTotalAssento: number;
  metricas: { kmExtra: number; minutosExtra: number; provedor?: string };
}

export function precificarDesvio(e: EntradaDesvio): PrecoDesvio {
  const kmExtra = Math.max(0, e.comDesvio.distanciaKm - e.direta.distanciaKm);
  const minExtra = Math.max(0, e.comDesvio.duracaoMin - e.direta.duracaoMin);
  const taxa =
    kmExtra * (e.custoKmExtra ?? CUSTO_KM_EXTRA) + minExtra * (e.custoMinExtra ?? CUSTO_MIN_EXTRA);
  return {
    precoBase: Number(e.precoBase.toFixed(2)),
    taxaDesvio: Number(taxa.toFixed(2)),
    precoTotalAssento: Number((e.precoBase + taxa).toFixed(2)),
    metricas: { kmExtra: Number(kmExtra.toFixed(2)), minutosExtra: Math.round(minExtra) },
  };
}

/** Métricas geodésicas (fallback quando o provedor externo falha). */
export function metricasGeometricas(pontos: Coordenada[]): MetricasTrecho {
  let km = 0;
  for (let i = 0; i < pontos.length - 1; i += 1) {
    km += distanciaKm(pontos[i]!, pontos[i + 1]!) * FATOR_VIARIO;
  }
  return { distanciaKm: km, duracaoMin: (km / VELOCIDADE_BUSCA_KMH) * 60 };
}
