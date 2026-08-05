/**
 * Regras do perfil Frotista (pessoa jurídica) e da situação operacional dos veículos.
 * Toda validação aqui é determinística e reaproveitada no cliente e no servidor.
 */

/** Quota mínima de veículos exigida para ativar a conta corporativa. */
export const MIN_VEICULOS_FROTISTA = 6;

export type StatusOperacional = "ativo" | "manutencao" | "inativo";

export const ROTULO_STATUS_OPERACIONAL: Record<StatusOperacional, string> = {
  ativo: "Ativo",
  manutencao: "Em manutenção",
  inativo: "Inativo",
};

export const COR_STATUS_OPERACIONAL: Record<StatusOperacional, string> = {
  ativo: "bg-success/15 text-success",
  manutencao: "bg-destructive/10 text-destructive",
  inativo: "bg-secondary text-muted-foreground",
};

export const MOTIVOS_INDISPONIBILIDADE = [
  "Manutenção preventiva",
  "Pane mecânica / quebra",
  "Sinistro ou colisão",
  "Documentação em regularização",
  "Outro motivo de força maior",
] as const;

/** Mantém apenas os dígitos do texto informado. */
export const somenteDigitos = (valor: string) => valor.replace(/\D+/g, "");

/** Formata o CNPJ na máscara 00.000.000/0000-00. */
export function formatarCnpj(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Validação dos dois dígitos verificadores do CNPJ (regra da Receita Federal). */
export function cnpjValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv = (base: string, pesos: number[]) => {
    const soma = base
      .split("")
      .reduce((acc, ch, i) => acc + Number(ch) * (pesos[i] as number), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = dv(d.slice(0, 12), p1);
  const d2 = dv(d.slice(0, 12) + String(d1), p2);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

/** Quantos veículos ainda faltam para a empresa poder operar. */
export const veiculosFaltantes = (total: number) => Math.max(0, MIN_VEICULOS_FROTISTA - total);

/** A operação da PJ só é liberada com a quota mínima atingida. */
export const frotistaLiberado = (totalVeiculos: number) =>
  totalVeiculos >= MIN_VEICULOS_FROTISTA;
