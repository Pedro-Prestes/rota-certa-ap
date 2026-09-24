export const TIPOS_DOCUMENTO = {
  passageiro: [
    { id: "documento_frente", rotulo: "Documento com foto — frente" },
    { id: "documento_verso", rotulo: "Documento com foto — verso" },
    { id: "selfie_documento", rotulo: "Selfie segurando o documento" },
  ],
  motorista: [
    { id: "documento_frente", rotulo: "Documento com foto — frente" },
    { id: "documento_verso", rotulo: "Documento com foto — verso" },
    { id: "cnh_frente", rotulo: "CNH — frente" },
    { id: "cnh_verso", rotulo: "CNH — verso" },
    { id: "selfie_documento", rotulo: "Selfie segurando o documento" },
  ],
} as const;

export type PerfilDocumento = keyof typeof TIPOS_DOCUMENTO;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[PerfilDocumento][number]["id"];
export type StatusDocumento = "em_analise" | "aprovado" | "correcao" | "rejeitado" | "excluido";

export const ROTULO_STATUS_DOCUMENTO: Record<StatusDocumento, string> = {
  em_analise: "Em análise",
  aprovado: "Aprovado",
  correcao: "Precisa corrigir",
  rejeitado: "Rejeitado",
  excluido: "Excluído",
};

export const MAX_DOCUMENTO_BYTES = 8 * 1024 * 1024;
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "application/pdf"] as const;
