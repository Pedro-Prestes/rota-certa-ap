/**
 * Credenciamento em 3 fases da pessoa jurídica (Cooperativas e Frotistas).
 *
 * Fase 1 — Empresa: CNPJ ativo + biometria facial do responsável legal.
 * Fase 2 — Conformidade documental específica do perfil.
 * Fase 3 — Frota e condutores: veículos e motoristas só entram com as fases
 *          anteriores aprovadas (bloqueio garantido também no banco).
 *
 * Regras puras, reaproveitadas no cliente e no servidor.
 */
import { cnpjValido, somenteDigitos } from "./frotista";

export type TipoEntidadePJ = "cooperativa" | "frotista";
export type StatusDoc = "pendente" | "em_analise" | "aprovado" | "reprovado" | "expirado";

export interface DefinicaoDocumento {
  tipo: string;
  titulo: string;
  descricao: string;
  /** Fase em que o documento é exigido. */
  fase: 1 | 2;
  exigeNumero: boolean;
  exigeValidade: boolean;
}

const CNPJ_DOC: DefinicaoDocumento = {
  tipo: "cnpj",
  titulo: "CNPJ ativo",
  descricao: "Cartão CNPJ com situação ativa e responsável legal identificado.",
  fase: 1,
  exigeNumero: true,
  exigeValidade: false,
};

export const DOCUMENTOS_PJ: Record<TipoEntidadePJ, DefinicaoDocumento[]> = {
  cooperativa: [
    CNPJ_DOC,
    {
      tipo: "ato_constitutivo",
      titulo: "Ato constitutivo / estatuto",
      descricao: "Estatuto social registrado com a diretoria vigente.",
      fase: 2,
      exigeNumero: false,
      exigeValidade: false,
    },
    {
      tipo: "alvara",
      titulo: "Registro ou alvará municipal",
      descricao: "Autorização do município para operar transporte de passageiros.",
      fase: 2,
      exigeNumero: true,
      exigeValidade: true,
    },
  ],
  frotista: [
    CNPJ_DOC,
    {
      tipo: "alvara",
      titulo: "Alvará de funcionamento",
      descricao: "Licença municipal da empresa transportadora.",
      fase: 2,
      exigeNumero: true,
      exigeValidade: true,
    },
    {
      tipo: "seguro_rcfv",
      titulo: "Seguro RCF-V / APP",
      descricao: "Apólice de responsabilidade civil e acidentes pessoais de passageiros.",
      fase: 2,
      exigeNumero: true,
      exigeValidade: true,
    },
  ],
};

export const ROTULO_STATUS_DOC: Record<StatusDoc, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  expirado: "Vencido",
};

export interface DocumentoPJ {
  id: string;
  tipo_documento: string;
  numero: string | null;
  orgao_emissor: string | null;
  validade: string | null;
  status: StatusDoc;
  pendencias: string[];
  observacao: string | null;
}

export interface EntradaDocumentoPJ {
  tipo_documento: string;
  numero?: string;
  orgao_emissor?: string;
  validade?: string;
}

const dias = (validade: string) =>
  Math.ceil((new Date(`${validade}T12:00:00`).getTime() - Date.now()) / 86_400_000);

/** Dias restantes até o vencimento (negativo = vencido). */
export const diasParaVencer = (validade: string | null | undefined) =>
  validade ? dias(validade) : null;

/** Prazo em que o documento entra em alerta de renovação. */
export const ALERTA_VENCIMENTO_DIAS = 30;

export interface AvaliacaoDoc {
  status: StatusDoc;
  pendencias: string[];
}

/** Avaliação automática do documento enviado, no padrão das plataformas de mobilidade. */
export function avaliarDocumentoPJ(
  tipoEntidade: TipoEntidadePJ,
  entrada: EntradaDocumentoPJ,
  cnpjDaEmpresa?: string,
): AvaliacaoDoc {
  const def = DOCUMENTOS_PJ[tipoEntidade].find((d) => d.tipo === entrada.tipo_documento);
  if (!def) return { status: "reprovado", pendencias: ["Tipo de documento não reconhecido."] };

  const pendencias: string[] = [];
  const numero = (entrada.numero ?? "").trim();

  if (def.exigeNumero && numero.length < 4) {
    pendencias.push("Informe o número do documento.");
  }

  if (def.tipo === "cnpj") {
    if (!cnpjValido(numero)) pendencias.push("CNPJ inválido.");
    else if (cnpjDaEmpresa && somenteDigitos(numero) !== somenteDigitos(cnpjDaEmpresa)) {
      pendencias.push("O CNPJ informado difere do CNPJ cadastrado na empresa.");
    }
  }

  if (def.exigeValidade) {
    if (!entrada.validade) pendencias.push("Informe a data de validade.");
    else {
      const d = dias(entrada.validade);
      if (Number.isNaN(d)) pendencias.push("Data de validade inválida.");
      else if (d < 0) pendencias.push("Documento vencido: envie a via renovada.");
    }
  }

  return { status: pendencias.length ? "reprovado" : "aprovado", pendencias };
}

/** Documento válido = aprovado e dentro da validade. */
export const documentoValido = (doc: DocumentoPJ | undefined | null) =>
  !!doc && doc.status === "aprovado" && (doc.validade === null || dias(doc.validade) >= 0);

export interface SituacaoPJ {
  fase1Ok: boolean;
  fase2Ok: boolean;
  /** Fase 3 liberada: pode cadastrar veículo e vincular condutores. */
  fase3Liberada: boolean;
  faseAtual: 1 | 2 | 3;
  score: number;
  verificada: boolean;
  faltantes: DefinicaoDocumento[];
  aVencer: { doc: DocumentoPJ; dias: number }[];
}

/**
 * Situação consolidada do credenciamento e score de conformidade (0–100):
 * biometria do responsável vale 20 pontos e os documentos dividem os 80 restantes.
 */
export function situacaoPJ(params: {
  tipoEntidade: TipoEntidadePJ;
  documentos: DocumentoPJ[];
  biometriaOk: boolean;
}): SituacaoPJ {
  const defs = DOCUMENTOS_PJ[params.tipoEntidade];
  const porTipo = new Map(params.documentos.map((d) => [d.tipo_documento, d]));

  const validos = defs.filter((d) => documentoValido(porTipo.get(d.tipo)));
  const faltantes = defs.filter((d) => !documentoValido(porTipo.get(d.tipo)));

  const fase1Ok = params.biometriaOk && documentoValido(porTipo.get("cnpj"));
  const fase2Ok =
    fase1Ok && defs.filter((d) => d.fase === 2).every((d) => documentoValido(porTipo.get(d.tipo)));

  const score = Math.round(
    (params.biometriaOk ? 20 : 0) + (validos.length / Math.max(defs.length, 1)) * 80,
  );

  const aVencer = params.documentos
    .filter((d) => d.status === "aprovado" && d.validade)
    .map((doc) => ({ doc, dias: dias(doc.validade as string) }))
    .filter((x) => x.dias <= ALERTA_VENCIMENTO_DIAS)
    .sort((a, b) => a.dias - b.dias);

  return {
    fase1Ok,
    fase2Ok,
    fase3Liberada: fase2Ok,
    faseAtual: fase2Ok ? 3 : fase1Ok ? 2 : 1,
    score,
    verificada: fase2Ok,
    faltantes,
    aVencer,
  };
}

/* ------------------------------------------------------- nível de frota (PJ) */

export type NivelFrota = "bronze" | "prata" | "ouro";

export const ROTULO_NIVEL_FROTA: Record<NivelFrota, string> = {
  bronze: "Frota Bronze",
  prata: "Frota Prata",
  ouro: "Frota Ouro",
};

export const BENEFICIO_NIVEL_FROTA: Record<NivelFrota, string> = {
  bronze: "Operação liberada e suporte padrão.",
  prata: "Prioridade média no despacho urbano e destaque nas buscas.",
  ouro: "Prioridade máxima no despacho e selo de destaque na vitrine de rotas.",
};

/**
 * Nível da frota no padrão das plataformas de mobilidade: combina conformidade
 * documental, tamanho da frota conforme e nota média dos condutores.
 */
export function nivelFrota(params: {
  score: number;
  veiculosConformes: number;
  notaMedia: number;
}): NivelFrota {
  if (params.score >= 100 && params.veiculosConformes >= 12 && params.notaMedia >= 4.8) {
    return "ouro";
  }
  if (params.score >= 80 && params.veiculosConformes >= 6 && params.notaMedia >= 4.5) {
    return "prata";
  }
  return "bronze";
}

/** Multiplicador de prioridade no despacho por nível de frota. */
export const PRIORIDADE_NIVEL: Record<NivelFrota, number> = {
  bronze: 1,
  prata: 1.15,
  ouro: 1.3,
};
