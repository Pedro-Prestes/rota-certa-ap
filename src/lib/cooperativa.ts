/**
 * Cooperativas cadastradas — regras puras compartilhadas cliente/servidor.
 *
 * A cooperativa recebe automaticamente a sua parcela da taxa administrativa
 * (padrão 3 pontos percentuais dos 10% cobrados) no instante em que o
 * pagamento do passageiro é confirmado. Para isso, o cadastro exige dados de
 * recebimento válidos (conta bancária e/ou chave Pix) no nome da entidade.
 */
import { cnpjValido, formatarCnpj, somenteDigitos } from "./frotista";
import { chavePixValida, nomeDoBanco, type TipoChavePix, type TipoConta } from "./carteira-motorista";

export { cnpjValido, formatarCnpj, somenteDigitos, nomeDoBanco };

/** Valor mínimo para disparar o repasse automático à cooperativa. */
export const REPASSE_COOPERATIVA_MINIMO = 10;

export type StatusCooperativa = "ativa" | "pendente" | "suspensa";
export type StatusRepasseCooperativa =
  | "solicitado"
  | "processando"
  | "pago"
  | "falhou"
  | "cancelado";

export const ROTULO_STATUS_COOPERATIVA: Record<StatusCooperativa, string> = {
  ativa: "Ativa",
  pendente: "Em análise",
  suspensa: "Suspensa",
};

export const ROTULO_STATUS_REPASSE_COOPERATIVA: Record<StatusRepasseCooperativa, string> = {
  solicitado: "Solicitado",
  processando: "Em processamento",
  pago: "Pago",
  falhou: "Falhou",
  cancelado: "Cancelado",
};

export const ROTULO_TRANSACAO_COOPERATIVA: Record<string, string> = {
  rateio_corrida: "Rateio de corrida",
  repasse: "Repasse enviado",
  ajuste: "Ajuste",
  estorno: "Estorno",
};

export interface EntradaCooperativa {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  responsavel_nome: string;
  email_contato?: string;
  telefone?: string;
  municipio?: string;
  uf?: string;
  titular_nome: string;
  titular_documento: string;
  banco_codigo?: string;
  tipo_conta?: TipoConta | "";
  agencia?: string;
  conta?: string;
  pix_tipo?: TipoChavePix | "";
  pix_chave?: string;
}

export interface ProblemaCooperativa {
  campo: string;
  mensagem: string;
}

/**
 * Valida o cadastro completo: identificação da entidade e, obrigatoriamente,
 * ao menos um meio de recebimento consistente no documento da cooperativa.
 */
export function validarCooperativa(dados: EntradaCooperativa): ProblemaCooperativa[] {
  const p: ProblemaCooperativa[] = [];

  if (!cnpjValido(dados.cnpj)) p.push({ campo: "cnpj", mensagem: "CNPJ inválido." });
  if (!dados.razao_social || dados.razao_social.trim().length < 4) {
    p.push({ campo: "razao_social", mensagem: "Informe a razão social da cooperativa." });
  }
  if (!dados.responsavel_nome || dados.responsavel_nome.trim().length < 5) {
    p.push({ campo: "responsavel_nome", mensagem: "Informe o nome do responsável." });
  }
  if (dados.email_contato && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dados.email_contato.trim())) {
    p.push({ campo: "email_contato", mensagem: "E-mail de contato inválido." });
  }
  if (!dados.titular_nome || dados.titular_nome.trim().length < 5) {
    p.push({ campo: "titular_nome", mensagem: "Informe o titular da conta de recebimento." });
  }

  const doc = somenteDigitos(dados.titular_documento ?? "");
  if (doc.length !== 14) {
    p.push({
      campo: "titular_documento",
      mensagem: "A conta de recebimento deve estar no CNPJ da cooperativa.",
    });
  } else if (cnpjValido(dados.cnpj) && doc !== somenteDigitos(dados.cnpj)) {
    p.push({
      campo: "titular_documento",
      mensagem: "O CNPJ do titular precisa ser o mesmo CNPJ cadastrado.",
    });
  }

  const temBanco = Boolean(dados.banco_codigo || dados.agencia || dados.conta);
  if (temBanco) {
    if (!/^\d{3}$/.test(somenteDigitos(dados.banco_codigo ?? ""))) {
      p.push({ campo: "banco_codigo", mensagem: "Código do banco deve ter 3 dígitos." });
    }
    if (dados.tipo_conta !== "CHECKING" && dados.tipo_conta !== "SAVINGS") {
      p.push({ campo: "tipo_conta", mensagem: "Escolha conta corrente ou poupança." });
    }
    const ag = somenteDigitos(dados.agencia ?? "");
    if (ag.length < 3 || ag.length > 6) {
      p.push({ campo: "agencia", mensagem: "Agência inválida (sem hífen)." });
    }
    const cc = somenteDigitos(dados.conta ?? "");
    if (cc.length < 4 || cc.length > 14) {
      p.push({ campo: "conta", mensagem: "Conta inválida (inclua o dígito)." });
    }
  }

  const temPix = Boolean(dados.pix_tipo || dados.pix_chave);
  if (temPix) {
    if (!dados.pix_tipo) {
      p.push({ campo: "pix_tipo", mensagem: "Escolha o tipo da chave Pix." });
    } else if (!chavePixValida(dados.pix_tipo as TipoChavePix, dados.pix_chave ?? "")) {
      p.push({ campo: "pix_chave", mensagem: "Chave Pix inválida para o tipo escolhido." });
    }
  }

  if (!temBanco && !temPix) {
    p.push({
      campo: "recebimento",
      mensagem: "Informe a conta corrente e o banco de preferência e/ou uma chave Pix.",
    });
  }

  return p;
}

/** Meio de recebimento preferido para o repasse automático. */
export function meioDeRecebimento(coop: {
  pix_chave?: string | null;
  pix_tipo?: string | null;
  banco_nome?: string | null;
  banco_codigo?: string | null;
  agencia?: string | null;
  conta?: string | null;
}): { metodo: "pix" | "ted"; descricao: string } | null {
  if (coop.pix_chave) return { metodo: "pix", descricao: `Pix (${coop.pix_tipo ?? "chave"})` };
  if (coop.banco_codigo && coop.agencia && coop.conta) {
    return {
      metodo: "ted",
      descricao: `${coop.banco_nome ?? nomeDoBanco(coop.banco_codigo)} • ag. ${coop.agencia} • c/c ${coop.conta}`,
    };
  }
  return null;
}
