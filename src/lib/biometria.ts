/** Regras compartilhadas da biometria facial (cliente e servidor). */

export type PerfilBiometria = "passageiro" | "motorista";
export type StatusBiometria = "aprovada" | "reprovada" | "em_analise";

export const ROTULO_STATUS_BIOMETRIA: Record<StatusBiometria, string> = {
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  em_analise: "Em análise",
};

export interface ProvaVida {
  /** Rosto detectado pelo navegador (quando a API está disponível). */
  rostoDetectado: boolean;
  /** Variação de pixels na região dos olhos durante o desafio de piscar. */
  piscada: number;
  /** Variação global de pixels durante o desafio de movimento da cabeça. */
  movimento: number;
  /** Nitidez estimada da selfie final. */
  nitidez: number;
  /** Luminosidade média da selfie final (0-255). */
  luminosidade: number;
  /** Quadros analisados na sessão. */
  quadros: number;
}

export const LIMITES = {
  piscada: 3.2,
  movimento: 4.5,
  nitidez: 6,
  luminosidadeMin: 45,
  luminosidadeMax: 235,
  quadrosMin: 12,
} as const;

export interface AvaliacaoBiometria {
  status: StatusBiometria;
  qualidade: number;
  pendencias: string[];
}

/** Avalia a sessão de captura de forma determinística. */
export function avaliarProvaVida(p: ProvaVida): AvaliacaoBiometria {
  const pendencias: string[] = [];
  let qualidade = 100;

  if (p.quadros < LIMITES.quadrosMin) {
    pendencias.push("Sessão de captura muito curta — repita o processo com calma.");
    qualidade -= 30;
  }
  if (p.piscada < LIMITES.piscada) {
    pendencias.push("Não identificamos a piscada solicitada.");
    qualidade -= 30;
  }
  if (p.movimento < LIMITES.movimento) {
    pendencias.push("Não identificamos o movimento da cabeça solicitado.");
    qualidade -= 30;
  }
  if (p.nitidez < LIMITES.nitidez) {
    pendencias.push("Imagem sem nitidez suficiente — limpe a lente e evite tremer.");
    qualidade -= 20;
  }
  if (p.luminosidade < LIMITES.luminosidadeMin) {
    pendencias.push("Ambiente escuro — procure um local mais iluminado.");
    qualidade -= 20;
  }
  if (p.luminosidade > LIMITES.luminosidadeMax) {
    pendencias.push("Imagem estourada de luz — evite luz direta atrás de você.");
    qualidade -= 20;
  }
  if (!p.rostoDetectado) qualidade -= 5;

  qualidade = Math.max(0, Math.min(100, Math.round(qualidade)));

  const status: StatusBiometria = pendencias.length
    ? qualidade < 45
      ? "reprovada"
      : "em_analise"
    : "aprovada";

  return { status, qualidade, pendencias };
}
