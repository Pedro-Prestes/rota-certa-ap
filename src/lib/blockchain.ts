/**
 * Cadeia de blocos interna e auditável do RotaCerta.
 *
 * Cada evento relevante de uma corrida (criação, trajeto percorrido, cobrança,
 * estorno, verificação de idoneidade) gera um bloco encadeado:
 *
 *   H_n = SHA-256( n ‖ H_{n-1} ‖ evento ‖ dados_canônicos )
 *
 * Qualquer alteração retroativa em um bloco quebra o encadeamento de todos os
 * blocos seguintes, o que torna o histórico verificável por qualquer ator da
 * plataforma — passageiro, motorista ou administrador.
 */

export const HASH_GENESE = "0".repeat(64);

export interface BlocoEntrada {
  indice: number;
  hash_anterior: string;
  evento: string;
  dados: unknown;
}

export interface Bloco extends BlocoEntrada {
  id: string;
  hash: string;
  corrida_id: string | null;
  registrado_por: string | null;
  created_at: string;
}

/** Serialização canônica: chaves ordenadas para que o hash seja reproduzível. */
export function canonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor ?? null);
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  const registro = valor as Record<string, unknown>;
  const partes = Object.keys(registro)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonico(registro[k])}`);
  return `{${partes.join(",")}}`;
}

export async function hashBloco(entrada: BlocoEntrada): Promise<string> {
  const texto = `${entrada.indice}|${entrada.hash_anterior}|${entrada.evento}|${canonico(entrada.dados)}`;
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ResultadoVerificacao {
  valida: boolean;
  total: number;
  primeiroInvalido: number | null;
  motivo: string | null;
}

/** Revalida toda a cadeia recalculando os hashes na ordem de índice. */
export async function verificarCadeia(blocos: Bloco[]): Promise<ResultadoVerificacao> {
  const ordenados = [...blocos].sort((a, b) => a.indice - b.indice);
  let anterior = HASH_GENESE;

  for (const bloco of ordenados) {
    if (bloco.hash_anterior !== anterior) {
      return {
        valida: false,
        total: ordenados.length,
        primeiroInvalido: bloco.indice,
        motivo: `Encadeamento rompido no bloco #${bloco.indice}.`,
      };
    }
    const esperado = await hashBloco(bloco);
    if (esperado !== bloco.hash) {
      return {
        valida: false,
        total: ordenados.length,
        primeiroInvalido: bloco.indice,
        motivo: `Conteúdo do bloco #${bloco.indice} não corresponde ao seu hash.`,
      };
    }
    anterior = bloco.hash;
  }

  return { valida: true, total: ordenados.length, primeiroInvalido: null, motivo: null };
}

export const EVENTOS: Record<string, string> = {
  corrida_criada: "Corrida registrada",
  trajeto_registrado: "Trajeto percorrido",
  cobranca_iniciada: "Cobrança iniciada",
  pagamento_confirmado: "Pagamento confirmado",
  estorno_processado: "Estorno processado",
  verificacao_idoneidade: "Verificação de idoneidade",
  custo_terceiro: "Custo de terceiros lançado",
};

export const rotuloEvento = (e: string) => EVENTOS[e] ?? e;

export const hashCurto = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
