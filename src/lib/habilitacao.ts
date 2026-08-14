/**
 * Regras da segunda fase do credenciamento do motorista: validade da CNH,
 * categoria compatível com o veículo e EAR (Exerce Atividade Remunerada),
 * exigida por lei para transporte remunerado de passageiros.
 */

import { somenteDigitos, validarCNH, type StatusVerificacao } from "./idoneidade";

export const CATEGORIAS_CNH = [
  "A",
  "B",
  "AB",
  "C",
  "AC",
  "D",
  "AD",
  "E",
  "AE",
] as const;

export type CategoriaCNH = (typeof CATEGORIAS_CNH)[number];

/** Assentos máximos (incluindo o condutor) permitidos por categoria. */
export const LIMITE_ASSENTOS_B = 8;

export const DIAS_AVISO_VENCIMENTO = 30;

export const temCategoria = (categoria: string, letra: string) =>
  (categoria || "").toUpperCase().includes(letra);

/** Categoria que habilita a conduzir veículo de passageiros de porte médio. */
export const habilitaCarro = (categoria: string) =>
  ["B", "C", "D", "E"].some((l) => temCategoria(categoria, l));

/** Categoria D: veículos com mais de 8 lugares, incluindo o condutor. */
export const habilitaVanOnibus = (categoria: string) =>
  ["D", "E"].some((l) => temCategoria(categoria, l));

export interface DadosHabilitacao {
  numero: string;
  categoria: string;
  ear: boolean;
  validade?: string | null | undefined;
  primeiraHabilitacao?: string | null | undefined;
}

export interface AvaliacaoHabilitacao {
  status: StatusVerificacao;
  pendencias: string[];
  avisos: string[];
  aprovado: boolean;
}

const diasAte = (iso: string) =>
  Math.floor((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86_400_000);

export function avaliarHabilitacao(d: DadosHabilitacao): AvaliacaoHabilitacao {
  const pendencias: string[] = [];
  const avisos: string[] = [];

  if (!somenteDigitos(d.numero)) {
    pendencias.push("Informe o número de registro da CNH (11 dígitos).");
  } else if (!validarCNH(d.numero)) {
    pendencias.push("Número da CNH inválido para os dígitos verificadores do Denatran.");
  }

  if (!d.categoria) {
    pendencias.push("Informe a categoria da CNH.");
  } else if (!habilitaCarro(d.categoria)) {
    pendencias.push(
      "Categoria insuficiente — o transporte de passageiros exige, no mínimo, a categoria B.",
    );
  }

  if (!d.validade) {
    pendencias.push("Informe a data de validade da CNH.");
  } else {
    const dias = diasAte(d.validade);
    if (dias < 0) pendencias.push("CNH vencida — renove o documento para voltar a operar.");
    else if (dias <= DIAS_AVISO_VENCIMENTO)
      avisos.push(`CNH vence em ${dias} dia(s) — providencie a renovação.`);
  }

  if (!d.ear) {
    pendencias.push(
      "CNH sem a observação EAR (Exerce Atividade Remunerada), obrigatória para transporte de passageiros.",
    );
  }

  if (d.primeiraHabilitacao) {
    const anos = -diasAte(d.primeiraHabilitacao) / 365.25;
    if (anos < 2) avisos.push("Menos de 2 anos de habilitação — cadastro sujeito a revisão manual.");
  }

  const status: StatusVerificacao = pendencias.length ? "reprovado" : "aprovado";
  return { status, pendencias, avisos, aprovado: status === "aprovado" };
}

/** Compatibilidade entre a CNH do condutor e o veículo a cadastrar. */
export function pendenciasCompatibilidade(
  habilitacao: { categoria: string; ear: boolean } | null,
  assentos: number,
): string[] {
  if (!habilitacao) {
    return ["Cadastre e aprove a CNH (fase 2) antes de cadastrar o veículo."];
  }
  const pendencias: string[] = [];
  if (!habilitacao.ear) {
    pendencias.push("CNH sem EAR — não permite transporte remunerado de passageiros.");
  }
  if (Number(assentos) > LIMITE_ASSENTOS_B) {
    if (!habilitaVanOnibus(habilitacao.categoria)) {
      pendencias.push(
        `Veículo com mais de ${LIMITE_ASSENTOS_B} lugares exige CNH categoria D (atual: ${habilitacao.categoria}).`,
      );
    }
  } else if (!habilitaCarro(habilitacao.categoria)) {
    pendencias.push(`CNH categoria ${habilitacao.categoria} não habilita este veículo.`);
  }
  return pendencias;
}

export const FASES = [
  {
    numero: 1,
    titulo: "Pessoa física e biometria facial",
    descricao: "CPF, nome civil, data de nascimento e selfie com prova de vida.",
  },
  {
    numero: 2,
    titulo: "Habilitação (CNH)",
    descricao: "Validade, categoria compatível e observação EAR.",
  },
  {
    numero: 3,
    titulo: "Veículo",
    descricao: "Placa, Renavam, chassi, CRLV e compatibilidade com a categoria da CNH.",
  },
] as const;
