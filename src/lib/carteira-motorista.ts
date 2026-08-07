/**
 * Carteira do motorista — regras puras (usadas no cliente e no servidor).
 *
 * Composição do ganho por viagem concluída:
 *   V_total     = soma das reservas aceitas (assentos × preço do assento)
 *   T_plataforma = V_total × (1 − repasse_motorista_percentual/100)
 *   V_liquido   = V_total − T_plataforma
 *
 * Repasses:
 *   • Semanal automático: toda segunda-feira, 06:00, saldo acima de R$ 10,00.
 *   • Saque instantâneo (Pix): mínimo R$ 5,00 com taxa fixa de R$ 1,50.
 */

export const SAQUE_MINIMO = 5;
export const TAXA_SAQUE_INSTANTANEO = 1.5;
export const REPASSE_SEMANAL_MINIMO = 10;

export type TipoConta = "CHECKING" | "SAVINGS";
export type TipoChavePix = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
export type TipoMovimento =
  | "RIDE_EARNING"
  | "PLATFORM_FEE"
  | "PAYOUT"
  | "BONUS"
  | "ADJUSTMENT";
export type StatusMovimento = "PENDING" | "COMPLETED" | "FAILED";
export type StatusRepasse = "REQUESTED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELED";

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Conta poupança",
};

export const ROTULO_CHAVE_PIX: Record<TipoChavePix, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  RANDOM: "Chave aleatória",
};

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  RIDE_EARNING: "Ganho de corrida",
  PLATFORM_FEE: "Taxa RotaCerta",
  PAYOUT: "Saque / repasse",
  BONUS: "Bônus / incentivo",
  ADJUSTMENT: "Ajuste / estorno",
};

export const ROTULO_STATUS_REPASSE: Record<StatusRepasse, string> = {
  REQUESTED: "Solicitado",
  PROCESSING: "Em processamento",
  PAID: "Pago",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
};

/** Instituições financeiras mais usadas (código COMPE/BACEN). */
export const BANCOS = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "260", nome: "Nu Pagamentos (Nubank)" },
  { codigo: "290", nome: "PagBank" },
  { codigo: "323", nome: "Mercado Pago" },
  { codigo: "336", nome: "C6 Bank" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "380", nome: "PicPay" },
  { codigo: "422", nome: "Banco Safra" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "756", nome: "Sicoob" },
] as const;

export const nomeDoBanco = (codigo: string) =>
  BANCOS.find((b) => b.codigo === codigo)?.nome ?? codigo;

export const somenteDigitos = (v: string) => (v ?? "").replace(/\D/g, "");

export function documentoValido(doc: string): boolean {
  const d = somenteDigitos(doc);
  return d.length === 11 || d.length === 14;
}

/** Valida a chave Pix conforme o tipo informado. */
export function chavePixValida(tipo: TipoChavePix, chave: string): boolean {
  const valor = (chave ?? "").trim();
  if (!valor) return false;
  if (tipo === "CPF") return somenteDigitos(valor).length === 11;
  if (tipo === "CNPJ") return somenteDigitos(valor).length === 14;
  if (tipo === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
  if (tipo === "PHONE") return somenteDigitos(valor).length >= 10 && somenteDigitos(valor).length <= 13;
  return valor.length >= 32;
}

export interface ProblemaConta {
  campo: string;
  mensagem: string;
}

export interface EntradaConta {
  holder_name: string;
  holder_document: string;
  bank_code?: string;
  account_type?: TipoConta | "";
  agency_number?: string;
  account_number?: string;
  pix_key_type?: TipoChavePix | "";
  pix_key?: string;
}

/**
 * Uma conta é válida quando tem dados bancários completos (banco, tipo,
 * agência e conta) e/ou uma chave Pix consistente com o tipo escolhido.
 */
export function validarConta(dados: EntradaConta): ProblemaConta[] {
  const problemas: ProblemaConta[] = [];
  if (!dados.holder_name || dados.holder_name.trim().length < 5) {
    problemas.push({ campo: "holder_name", mensagem: "Informe o nome completo do titular." });
  }
  if (!documentoValido(dados.holder_document)) {
    problemas.push({ campo: "holder_document", mensagem: "CPF/CNPJ do titular inválido." });
  }

  const temBanco = Boolean(dados.bank_code || dados.agency_number || dados.account_number);
  if (temBanco) {
    if (!/^\d{3}$/.test(somenteDigitos(dados.bank_code ?? ""))) {
      problemas.push({ campo: "bank_code", mensagem: "Código do banco deve ter 3 dígitos." });
    }
    if (dados.account_type !== "CHECKING" && dados.account_type !== "SAVINGS") {
      problemas.push({ campo: "account_type", mensagem: "Escolha conta corrente ou poupança." });
    }
    const agencia = somenteDigitos(dados.agency_number ?? "");
    if (agencia.length < 3 || agencia.length > 6) {
      problemas.push({ campo: "agency_number", mensagem: "Agência inválida (sem hífen)." });
    }
    const conta = somenteDigitos(dados.account_number ?? "");
    if (conta.length < 4 || conta.length > 14) {
      problemas.push({ campo: "account_number", mensagem: "Conta inválida (inclua o dígito)." });
    }
  }

  const temPix = Boolean(dados.pix_key || dados.pix_key_type);
  if (temPix) {
    const tipo = dados.pix_key_type as TipoChavePix;
    if (!tipo || !ROTULO_CHAVE_PIX[tipo]) {
      problemas.push({ campo: "pix_key_type", mensagem: "Escolha o tipo da chave Pix." });
    } else if (!chavePixValida(tipo, dados.pix_key ?? "")) {
      problemas.push({ campo: "pix_key", mensagem: "Chave Pix inválida para o tipo escolhido." });
    }
  }

  if (!temBanco && !temPix) {
    problemas.push({
      campo: "pix_key",
      mensagem: "Cadastre uma chave Pix ou os dados bancários completos.",
    });
  }

  return problemas;
}

/** Taxa aplicada ao saque conforme a modalidade. */
export function taxaDoSaque(modo: "INSTANT" | "WEEKLY"): number {
  return modo === "INSTANT" ? TAXA_SAQUE_INSTANTANEO : 0;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export interface ComposicaoSaque {
  valor: number;
  taxa: number;
  liquido: number;
}

export function comporSaque(valor: number, modo: "INSTANT" | "WEEKLY"): ComposicaoSaque {
  const bruto = arred(Math.max(0, Number(valor) || 0));
  const taxa = Math.min(taxaDoSaque(modo), bruto);
  return { valor: bruto, taxa: arred(taxa), liquido: arred(bruto - taxa) };
}

/** Rateio do ganho da viagem entre motorista e plataforma. */
export function comporGanhoViagem(bruto: number, repassePercentual: number) {
  const total = arred(Math.max(0, Number(bruto) || 0));
  const percentual = Math.min(100, Math.max(0, Number(repassePercentual) || 0));
  const liquido = arred((total * percentual) / 100);
  return { total, percentual, taxaPlataforma: arred(total - liquido), liquido };
}
