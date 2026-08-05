/**
 * Proteção RotaCerta — assistência 24h em caso de pane.
 *
 * Duas modalidades de cobertura:
 *
 *  - `mensal`   → contratada pelo motorista, vale 30 dias e cobre todas as
 *                 saídas dele no período.
 *  - `avulsa`   → contratada por assento pelo passageiro (ou pelo motorista
 *                 sem plano), vinculada a uma saída específica (rota + data).
 *
 * A cobertura ativa é o que autoriza a abertura de um chamado de pane. O
 * atendimento tem duas providências paralelas: veículo substituto para dar
 * continuidade à viagem dos passageiros e remoção do veículo avariado até a
 * oficina indicada pelo motorista.
 */

export type ModalidadeCobertura = "mensal" | "avulsa";

export const PRICE_PROTECAO_MENSAL = "protecao_mensal";
export const PRICE_PROTECAO_AVULSA = "protecao_avulsa_assento";

/** Valor mensal da proteção do motorista (R$). */
export const VALOR_PROTECAO_MENSAL = 39.9;
/** Valor da proteção avulsa por assento da saída (R$). */
export const VALOR_PROTECAO_ASSENTO = 4.9;
/** Duração da cobertura mensal, em dias. */
export const DIAS_COBERTURA_MENSAL = 30;

export function valorDoPrice(priceId: string): number | null {
  if (priceId === PRICE_PROTECAO_MENSAL) return VALOR_PROTECAO_MENSAL;
  if (priceId === PRICE_PROTECAO_AVULSA) return VALOR_PROTECAO_ASSENTO;
  return null;
}

export function ehPriceProtecao(priceId: string | null | undefined): boolean {
  return priceId === PRICE_PROTECAO_MENSAL || priceId === PRICE_PROTECAO_AVULSA;
}

export const COBERTURAS = [
  "Veículo substituto despachado para levar os passageiros ao destino",
  "Remoção do veículo avariado até a oficina indicada pelo motorista",
  "Acompanhamento do chamado em tempo real por motorista e passageiros",
  "Registro do atendimento no livro de auditoria da plataforma",
] as const;

/* ---------------------------------------------------------------- sinistro */

export type StatusSinistro =
  | "aberto"
  | "substituto_despachado"
  | "passageiros_realocados"
  | "reboque_acionado"
  | "veiculo_na_oficina"
  | "concluido"
  | "cancelado";

export const ROTULO_SINISTRO: Record<StatusSinistro, string> = {
  aberto: "Chamado aberto",
  substituto_despachado: "Veículo substituto despachado",
  passageiros_realocados: "Passageiros realocados",
  reboque_acionado: "Reboque acionado",
  veiculo_na_oficina: "Veículo na oficina",
  concluido: "Atendimento concluído",
  cancelado: "Chamado cancelado",
};

export const COR_SINISTRO: Record<StatusSinistro, string> = {
  aberto: "bg-destructive/10 text-destructive",
  substituto_despachado: "bg-accent/15 text-accent-foreground",
  passageiros_realocados: "bg-accent/15 text-accent-foreground",
  reboque_acionado: "bg-secondary text-foreground",
  veiculo_na_oficina: "bg-secondary text-foreground",
  concluido: "bg-primary/10 text-primary",
  cancelado: "bg-muted text-muted-foreground",
};

/** Transições válidas do atendimento — o fluxo nunca anda para trás. */
export const TRANSICOES: Record<StatusSinistro, StatusSinistro[]> = {
  aberto: ["substituto_despachado", "reboque_acionado", "cancelado"],
  substituto_despachado: ["passageiros_realocados", "reboque_acionado", "cancelado"],
  passageiros_realocados: ["reboque_acionado", "veiculo_na_oficina", "concluido"],
  reboque_acionado: ["veiculo_na_oficina", "passageiros_realocados", "concluido"],
  veiculo_na_oficina: ["concluido"],
  concluido: [],
  cancelado: [],
};

export function podeTransicionar(de: StatusSinistro, para: StatusSinistro): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

export const TIPOS_PANE = [
  "Pane mecânica",
  "Pane elétrica",
  "Pneu / suspensão",
  "Superaquecimento",
  "Falta de combustível",
  "Colisão sem vítimas",
  "Outro",
] as const;

export type TipoPane = (typeof TIPOS_PANE)[number];

export function coberturaAtiva(cob: {
  status: string;
  vigencia_fim: string;
}): boolean {
  return cob.status === "ativa" && new Date(cob.vigencia_fim).getTime() > Date.now();
}

export function valorProtecaoAvulsa(assentos: number): number {
  const n = Math.max(1, Math.min(20, Math.trunc(assentos) || 1));
  return Math.round(n * VALOR_PROTECAO_ASSENTO * 100) / 100;
}

export function reais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
