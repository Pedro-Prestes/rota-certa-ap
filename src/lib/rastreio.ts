/**
 * Rastreio da viagem em atividade.
 *
 * A conectividade via Starlink nos ramais permite transmitir a posição do
 * veículo durante a viagem. O aparelho do motorista envia um ponto a cada
 * `INTERVALO_ENVIO_MS` ou a cada `DISTANCIA_MINIMA_M` percorridos — o que
 * ocorrer primeiro — e a plataforma acumula o trajeto de forma append-only.
 *
 * Quando o sinal cai, os pontos ficam numa fila local e são reenviados na
 * ordem. A tela nunca finge que o veículo parou: se a última posição tem mais
 * de `LIMIAR_SINAL_MS`, ela mostra "sinal instável" com o horário do último
 * ponto conhecido.
 */

import { distanciaKm, type Coordenada } from "./embarque";

/** Intervalo alvo de envio de posição. */
export const INTERVALO_ENVIO_MS = 15_000;
/** Distância mínima entre dois pontos gravados, em metros. */
export const DISTANCIA_MINIMA_M = 100;
/** Acima disso, a última posição é considerada desatualizada. */
export const LIMIAR_SINAL_MS = 3 * 60_000;
/** Precisão pior que isso é descartada (ruído de GPS). */
export const PRECISAO_MAXIMA_M = 120;

export type StatusViagem =
  | "planejada"
  | "em_busca"
  | "em_viagem"
  | "interrompida"
  | "concluida";

export const ROTULO_VIAGEM: Record<StatusViagem, string> = {
  planejada: "Planejada",
  em_busca: "Buscando passageiros",
  em_viagem: "Em viagem",
  interrompida: "Interrompida por pane",
  concluida: "Concluída",
};

export const COR_VIAGEM: Record<StatusViagem, string> = {
  planejada: "bg-secondary text-foreground",
  em_busca: "bg-accent/15 text-accent-foreground",
  em_viagem: "bg-primary/10 text-primary",
  interrompida: "bg-destructive/10 text-destructive",
  concluida: "bg-muted text-muted-foreground",
};

export const VIAGEM_EM_CURSO: StatusViagem[] = ["em_busca", "em_viagem", "interrompida"];

export interface Posicao extends Coordenada {
  velocidade_kmh?: number | null;
  precisao_m?: number | null;
  registrado_em: string;
}

/** Descarta pontos imprecisos ou muito próximos do anterior. */
export function deveGravar(anterior: Posicao | null, nova: Posicao): boolean {
  if ((nova.precisao_m ?? 0) > PRECISAO_MAXIMA_M) return false;
  if (!anterior) return true;
  const metros = distanciaKm(anterior, nova) * 1000;
  const decorrido = new Date(nova.registrado_em).getTime() - new Date(anterior.registrado_em).getTime();
  return metros >= DISTANCIA_MINIMA_M || decorrido >= INTERVALO_ENVIO_MS;
}

/** Distância acumulada do trajeto, em km. */
export function distanciaPercorrida(pontos: Posicao[]): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i += 1) {
    total += distanciaKm(pontos[i - 1]!, pontos[i]!);
  }
  return Math.round(total * 100) / 100;
}

export type Sinal = "ao_vivo" | "instavel" | "sem_dados";

export function estadoDoSinal(ultimaEm: string | null | undefined, agora = Date.now()): Sinal {
  if (!ultimaEm) return "sem_dados";
  return agora - new Date(ultimaEm).getTime() > LIMIAR_SINAL_MS ? "instavel" : "ao_vivo";
}

export const ROTULO_SINAL: Record<Sinal, string> = {
  ao_vivo: "Ao vivo",
  instavel: "Sinal instável",
  sem_dados: "Sem transmissão",
};

export function horaLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Duração legível entre dois instantes. */
export function duracao(inicio: string | null, fim: string | null): string {
  if (!inicio) return "—";
  const ms = (fim ? new Date(fim).getTime() : Date.now()) - new Date(inicio).getTime();
  if (ms < 0) return "—";
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
}
