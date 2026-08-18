/**
 * Bips da plataforma — assinaturas sonoras sintetizadas na hora (Web Audio).
 *
 * Nada de arquivos de áudio: cada aviso é uma pequena melodia com envelope
 * suave (ataque curto, cauda longa) e filtro passa-baixa, para soar marcante
 * sem ser estridente — no espírito dos avisos de chamada da Uber e da 99, mas
 * com timbre próprio do RotaCerta.
 */

export type NomeBip =
  | "chamada_urbana"
  | "chamada_fracionada"
  | "chamada_exclusiva"
  | "aceite_urbano"
  | "aceite_intermunicipal";

interface Nota {
  /** Frequência em Hz. */
  f: number;
  /** Início relativo, em segundos. */
  t: number;
  /** Duração audível, em segundos. */
  d: number;
  /** Volume relativo (0 a 1). */
  g?: number;
  /** Timbre da nota. */
  onda?: OscillatorType;
}

interface Assinatura {
  notas: Nota[];
  /** Quantas vezes a assinatura toca. */
  repeticoes?: number;
  /** Intervalo entre repetições, em segundos. */
  intervalo?: number;
  /** Corte do filtro passa-baixa. */
  brilho?: number;
}

const D5 = 587.33;
const F5 = 698.46;
const A5 = 880;
const D6 = 1174.66;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;
const G3 = 196;
const D4 = 293.66;
const A3 = 220;

const ASSINATURAS: Record<NomeBip, Assinatura> = {
  /** Chamada urbana: tríade ascendente, viva e curta — pede ação imediata. */
  chamada_urbana: {
    notas: [
      { f: D5, t: 0, d: 0.18 },
      { f: A5, t: 0.12, d: 0.2 },
      { f: D6, t: 0.24, d: 0.5, g: 0.9 },
      { f: D4, t: 0, d: 0.6, g: 0.28, onda: "triangle" },
    ],
    repeticoes: 3,
    intervalo: 0.78,
    brilho: 4200,
  },
  /** Chamada intermunicipal fracionada: arpejo sereno, com cauda de viagem. */
  chamada_fracionada: {
    notas: [
      { f: C5, t: 0, d: 0.3 },
      { f: E5, t: 0.16, d: 0.32 },
      { f: G5, t: 0.32, d: 0.75, g: 0.85 },
      { f: A3, t: 0, d: 1.0, g: 0.3, onda: "triangle" },
    ],
    repeticoes: 2,
    intervalo: 1.15,
    brilho: 3000,
  },
  /** Chamada exclusiva: acorde amplo e nobre, sinalizando corrida premium. */
  chamada_exclusiva: {
    notas: [
      { f: G3, t: 0, d: 1.5, g: 0.34, onda: "triangle" },
      { f: D5, t: 0.02, d: 0.5 },
      { f: G5, t: 0.2, d: 0.55 },
      { f: B5, t: 0.38, d: 0.6 },
      { f: E6, t: 0.56, d: 1.2, g: 0.95 },
    ],
    repeticoes: 2,
    intervalo: 1.7,
    brilho: 3600,
  },
  /** Motorista aceitou a corrida urbana: dois toques claros de confirmação. */
  aceite_urbano: {
    notas: [
      { f: A5, t: 0, d: 0.16 },
      { f: E6, t: 0.13, d: 0.5, g: 0.9 },
    ],
    brilho: 4800,
  },
  /** Aceite/confirmação intermunicipal e interestadual: acorde caloroso. */
  aceite_intermunicipal: {
    notas: [
      { f: E5, t: 0, d: 0.26 },
      { f: B5, t: 0.14, d: 0.3 },
      { f: F5 * 2, t: 0.3, d: 0.85, g: 0.85 },
      { f: A3, t: 0, d: 0.9, g: 0.26, onda: "triangle" },
    ],
    brilho: 3400,
  },
};

let ctx: AudioContext | null = null;
let liberado = false;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Navegadores só permitem áudio após um gesto do usuário: chame uma vez no
 * carregamento para destravar o contexto no primeiro toque ou clique.
 */
export function liberarBip() {
  if (liberado || typeof window === "undefined") return;
  liberado = true;
  const destravar = () => {
    contexto();
    window.removeEventListener("pointerdown", destravar);
    window.removeEventListener("keydown", destravar);
  };
  window.addEventListener("pointerdown", destravar, { once: true });
  window.addEventListener("keydown", destravar, { once: true });
}

/** Toca uma das assinaturas sonoras. Silencioso se o áudio não estiver liberado. */
export function tocarBip(nome: NomeBip, volume = 0.5) {
  const audio = contexto();
  const assinatura = ASSINATURAS[nome];
  if (!audio || !assinatura) return;

  const mestre = audio.createGain();
  mestre.gain.value = Math.max(0, Math.min(1, volume));

  const filtro = audio.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = assinatura.brilho ?? 3500;
  filtro.Q.value = 0.7;

  mestre.connect(filtro);
  filtro.connect(audio.destination);

  const repeticoes = assinatura.repeticoes ?? 1;
  const intervalo = assinatura.intervalo ?? 0;
  const t0 = audio.currentTime + 0.03;

  for (let r = 0; r < repeticoes; r += 1) {
    const base = t0 + r * intervalo;
    for (const nota of assinatura.notas) {
      const inicio = base + nota.t;
      const fim = inicio + nota.d;
      const pico = (nota.g ?? 0.7) * 0.5;

      const osc = audio.createOscillator();
      osc.type = nota.onda ?? "sine";
      osc.frequency.setValueAtTime(nota.f, inicio);

      // Brilho extra: harmônico duas oitavas acima, bem discreto.
      const harmonico = audio.createOscillator();
      harmonico.type = "sine";
      harmonico.frequency.setValueAtTime(nota.f * 2, inicio);

      const ganho = audio.createGain();
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

      const ganhoHarmonico = audio.createGain();
      ganhoHarmonico.gain.setValueAtTime(0.0001, inicio);
      ganhoHarmonico.gain.exponentialRampToValueAtTime(pico * 0.18, inicio + 0.02);
      ganhoHarmonico.gain.exponentialRampToValueAtTime(0.0001, fim * 0.999);

      osc.connect(ganho).connect(mestre);
      harmonico.connect(ganhoHarmonico).connect(mestre);

      osc.start(inicio);
      osc.stop(fim + 0.05);
      harmonico.start(inicio);
      harmonico.stop(fim + 0.05);
    }
  }

  // Vibração discreta no celular acompanha as chamadas.
  if (nome.startsWith("chamada") && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate?.([120, 90, 160]);
    } catch {
      /* vibração é opcional */
    }
  }
}
