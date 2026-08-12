/**
 * Modo urbano (corridas dentro do município, seus distritos e vilarejos).
 *
 * Tarifação dinâmica, determinística e compartilhada entre cliente e servidor:
 *
 *   Preço = max(mínimo, (bandeirada + R$/km · km + R$/min · minutos) · fator)
 *
 * O fator de pico só é aplicado nas faixas de horário de maior demanda.
 * A taxa administrativa é somada por cima da base, como nas demais cobranças.
 */

export interface TarifaUrbana {
  id?: string;
  municipio: string;
  uf: string;
  bandeirada: number;
  valor_km: number;
  valor_minuto: number;
  minimo: number;
  fator_pico: number;
  taxa_cancelamento: number;
  ativa?: boolean;
}

export const TARIFA_URBANA_PADRAO: Omit<TarifaUrbana, "municipio" | "uf"> = {
  bandeirada: 5.5,
  valor_km: 2.2,
  valor_minuto: 0.35,
  minimo: 9,
  fator_pico: 1.3,
  taxa_cancelamento: 5,
};

export type StatusCorridaUrbana =
  | "ofertada"
  | "aceita"
  | "a_caminho"
  | "aguardando"
  | "em_viagem"
  | "concluida"
  | "cancelada"
  | "expirada";

export const ROTULO_STATUS_URBANO: Record<StatusCorridaUrbana, string> = {
  ofertada: "Aguardando motorista",
  aceita: "Motorista confirmado",
  a_caminho: "Motorista a caminho",
  aguardando: "Motorista no local",
  em_viagem: "Em viagem",
  concluida: "Concluída",
  cancelada: "Cancelada",
  expirada: "Sem motorista disponível",
};

/** Sequência oficial das etapas da corrida urbana. */
export const ETAPAS_URBANAS: StatusCorridaUrbana[] = [
  "aceita",
  "a_caminho",
  "aguardando",
  "em_viagem",
  "concluida",
];

export const proximaEtapa = (atual: string): StatusCorridaUrbana | null => {
  const i = ETAPAS_URBANAS.indexOf(atual as StatusCorridaUrbana);
  if (i < 0 || i >= ETAPAS_URBANAS.length - 1) return null;
  return ETAPAS_URBANAS[i + 1]!;
};

/** Segundos que o motorista tem para aceitar uma oferta imediata. */
export const SEGUNDOS_PARA_ACEITAR = 45;

/** Raio de despacho da oferta imediata (km). */
export const RAIO_DESPACHO_KM = 12;

/** Raio de busca do motorista designado para uma corrida agendada (km). */
export const RAIO_AGENDAMENTO_KM = 25;

/** Janela (minutos) em que um agendamento bloqueia o motorista designado. */
export const JANELA_AGENDAMENTO_MIN = 90;



/** Após o motorista sair para o embarque, o cancelamento tem custo. */
export const CANCELAMENTO_COM_CUSTO: StatusCorridaUrbana[] = [
  "a_caminho",
  "aguardando",
  "em_viagem",
];

const arred = (v: number) => Math.round(v * 100) / 100;

/** Faixas de pico (horário local de Brasília): manhã e fim de tarde em dia útil. */
export function emHorarioDePico(data = new Date()): boolean {
  const local = new Date(data.getTime() - 3 * 60 * 60 * 1000); // UTC−3
  const dia = local.getUTCDay();
  const hora = local.getUTCHours();
  if (dia === 0) return false;
  return (hora >= 6 && hora < 9) || (hora >= 17 && hora < 20);
}

export interface PrecoUrbano {
  bandeirada: number;
  valorKm: number;
  valorMinuto: number;
  distanciaKm: number;
  duracaoMin: number;
  fatorAplicado: number;
  parcelaDistancia: number;
  parcelaTempo: number;
  subtotal: number;
  minimoAplicado: boolean;
  base: number;
  itens: { rotulo: string; valor: number }[];
}

export function precificarCorridaUrbana(entrada: {
  tarifa: TarifaUrbana;
  distanciaKm: number;
  duracaoMin: number;
  pico?: boolean;
}): PrecoUrbano {
  const t = entrada.tarifa;
  const km = Math.max(0, Number(entrada.distanciaKm) || 0);
  const min = Math.max(0, Number(entrada.duracaoMin) || 0);
  const fator = entrada.pico ? Math.max(1, Number(t.fator_pico) || 1) : 1;

  const parcelaDistancia = arred(km * (Number(t.valor_km) || 0));
  const parcelaTempo = arred(min * (Number(t.valor_minuto) || 0));
  const subtotal = arred((Number(t.bandeirada) || 0) + parcelaDistancia + parcelaTempo);
  const comFator = arred(subtotal * fator);
  const minimo = Number(t.minimo) || 0;
  const base = arred(Math.max(minimo, comFator));

  return {
    bandeirada: arred(Number(t.bandeirada) || 0),
    valorKm: Number(t.valor_km) || 0,
    valorMinuto: Number(t.valor_minuto) || 0,
    distanciaKm: arred(km),
    duracaoMin: Math.round(min),
    fatorAplicado: fator,
    parcelaDistancia,
    parcelaTempo,
    subtotal,
    minimoAplicado: base > comFator,
    base,
    itens: [
      { rotulo: "Bandeirada", valor: arred(Number(t.bandeirada) || 0) },
      { rotulo: `Distância (${arred(km)} km)`, valor: parcelaDistancia },
      { rotulo: `Tempo estimado (${Math.round(min)} min)`, valor: parcelaTempo },
      ...(fator > 1 ? [{ rotulo: `Fator de pico (${fator}×)`, valor: arred(comFator - subtotal) }] : []),
      { rotulo: "Base da corrida", valor: base },
    ],
  };
}

/** Distância geodésica em km (usada no despacho por proximidade). */
export function distanciaKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return arred(2 * R * Math.asin(Math.min(1, Math.sqrt(s))));
}

export const moeda = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
