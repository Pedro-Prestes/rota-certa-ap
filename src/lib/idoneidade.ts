/**
 * Regras de idoneidade de passageiros, motoristas e veículos.
 *
 * As validações determinísticas (dígitos verificadores, formato de placa,
 * idade do veículo, vigência do CRLV) rodam localmente e sempre. Quando um
 * provedor externo estiver configurado, o resultado da consulta é somado a
 * estas regras — ver `idoneidade.server.ts`.
 */

export type AlvoVerificacao = "passageiro" | "motorista" | "veiculo";
export type StatusVerificacao = "pendente" | "em_analise" | "aprovado" | "reprovado" | "expirado";

export const ROTULO_ALVO: Record<AlvoVerificacao, string> = {
  passageiro: "Passageiro",
  motorista: "Motorista",
  veiculo: "Veículo",
};

export const ROTULO_STATUS: Record<StatusVerificacao, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  expirado: "Expirado",
};

export const somenteDigitos = (v: string) => (v || "").replace(/\D/g, "");

export function validarCPF(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(cpf[tamanho])) return false;
  }
  return true;
}

/** CNH: 11 dígitos com os dois dígitos verificadores do Denatran. */
export function validarCNH(valor: string): boolean {
  const cnh = somenteDigitos(valor);
  if (cnh.length !== 11 || /^(\d)\1{10}$/.test(cnh)) return false;

  let soma = 0;
  for (let i = 0, peso = 9; i < 9; i++, peso--) soma += Number(cnh[i]) * peso;
  let dv1 = soma % 11;
  let acrescimo = 0;
  if (dv1 >= 10) {
    dv1 = 0;
    acrescimo = 2;
  }

  soma = 0;
  for (let i = 0, peso = 1; i < 9; i++, peso++) soma += Number(cnh[i]) * peso;
  let dv2 = soma % 11;
  if (dv2 >= 10) dv2 = 0;
  dv2 = Math.max(0, dv2 - acrescimo);

  return dv1 === Number(cnh[9]) && dv2 === Number(cnh[10]);
}

/** Placa antiga (ABC1234) ou padrão Mercosul (ABC1D23). */
export function validarPlaca(valor: string): boolean {
  const placa = (valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d{4}$/.test(placa) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(placa);
}

export const formatarPlaca = (valor: string) =>
  (valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

/** Renavam: 11 dígitos com dígito verificador módulo 11. */
export function validarRenavam(valor: string): boolean {
  const renavam = somenteDigitos(valor).padStart(11, "0");
  if (renavam.length !== 11 || /^0{11}$/.test(renavam)) return false;
  const base = renavam.slice(0, 10);
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * (pesos[i] ?? 0), 0);
  const resto = (soma * 10) % 11;
  const dv = resto === 10 ? 0 : resto;
  return dv === Number(renavam[10]);
}

/** Chassi (VIN) de 17 posições, sem as letras I, O e Q. */
export function validarChassi(valor: string): boolean {
  const chassi = (valor || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  return chassi.length === 17;
}

export const IDADE_MAXIMA_VEICULO = 10;

export interface DadosPessoa {
  documento: string;
  nome?: string | undefined;
  cnh?: string | undefined;
  dataNascimento?: string | undefined;
}

export interface DadosVeiculo {
  placa: string;
  ano: number;
  renavam?: string | null | undefined;
  chassi?: string | null | undefined;
  assentos?: number | undefined;
  crlv_exercicio?: number | null | undefined;
  crlv_situacao?: string | null | undefined;
}

export interface AvaliacaoIdoneidade {
  status: StatusVerificacao;
  pontuacao: number;
  pendencias: string[];
  aprovado: boolean;
}

function consolidar(pendencias: string[], bloqueios: number): AvaliacaoIdoneidade {
  const pontuacao = Math.max(0, 100 - pendencias.length * 18 - bloqueios * 22);
  const status: StatusVerificacao =
    bloqueios > 0 ? "reprovado" : pendencias.length > 0 ? "em_analise" : "aprovado";
  return { status, pontuacao, pendencias, aprovado: status === "aprovado" };
}

export function avaliarPessoa(alvo: "passageiro" | "motorista", d: DadosPessoa): AvaliacaoIdoneidade {
  const pendencias: string[] = [];
  let bloqueios = 0;

  if (!validarCPF(d.documento)) {
    pendencias.push("CPF inválido — confira os 11 dígitos informados.");
    bloqueios++;
  }
  if (!d.nome || d.nome.trim().split(/\s+/).length < 2) {
    pendencias.push("Informe o nome civil completo, como consta no documento.");
  }
  if (alvo === "motorista") {
    if (!d.cnh) {
      pendencias.push("Número da CNH não informado.");
      bloqueios++;
    } else if (!validarCNH(d.cnh)) {
      pendencias.push("Número da CNH inválido para os dígitos verificadores do Denatran.");
      bloqueios++;
    }
    if (d.dataNascimento) {
      const idade =
        (Date.now() - new Date(d.dataNascimento).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (idade < 21) {
        pendencias.push("Motorista com menos de 21 anos — exigência de transporte remunerado.");
        bloqueios++;
      }
    } else {
      pendencias.push("Data de nascimento não informada.");
    }
  }

  return consolidar(pendencias, bloqueios);
}

export function avaliarVeiculo(
  d: DadosVeiculo,
  anoVigente = new Date().getFullYear(),
): AvaliacaoIdoneidade {
  const pendencias: string[] = [];
  let bloqueios = 0;

  if (!validarPlaca(d.placa)) {
    pendencias.push("Placa fora dos padrões brasileiro antigo (ABC1234) e Mercosul (ABC1D23).");
    bloqueios++;
  }
  if (!Number(d.ano) || anoVigente - Number(d.ano) > IDADE_MAXIMA_VEICULO) {
    pendencias.push(
      `Veículo com mais de ${IDADE_MAXIMA_VEICULO} anos de fabricação — fora da regra da plataforma.`,
    );
    bloqueios++;
  }
  if (d.renavam && !validarRenavam(d.renavam)) {
    pendencias.push("Renavam inválido — dígito verificador não confere.");
    bloqueios++;
  }
  if (!d.renavam) pendencias.push("Renavam não informado.");
  if (d.chassi && !validarChassi(d.chassi)) {
    pendencias.push("Chassi deve ter 17 caracteres, sem as letras I, O e Q.");
  }
  if (d.assentos !== undefined && Number(d.assentos) < 4) {
    pendencias.push("Veículo precisa de no mínimo 4 assentos para transporte de passageiros.");
    bloqueios++;
  }
  if (!d.crlv_exercicio) {
    pendencias.push("Exercício do CRLV não informado.");
  } else if (Number(d.crlv_exercicio) < anoVigente - 1) {
    pendencias.push("CRLV vencido — licenciamento precisa estar em dia.");
    bloqueios++;
  }
  if (d.crlv_situacao && !/regular|liberad/i.test(d.crlv_situacao)) {
    pendencias.push(`Situação do CRLV informada como "${d.crlv_situacao}".`);
    bloqueios++;
  }

  return consolidar(pendencias, bloqueios);
}
