/** Unidades federativas do Brasil (26 estados + Distrito Federal). */

export interface UnidadeFederativa {
  sigla: string;
  nome: string;
  regiao: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
}

export const UFS: UnidadeFederativa[] = [
  { sigla: "AC", nome: "Acre", regiao: "Norte" },
  { sigla: "AL", nome: "Alagoas", regiao: "Nordeste" },
  { sigla: "AP", nome: "Amapá", regiao: "Norte" },
  { sigla: "AM", nome: "Amazonas", regiao: "Norte" },
  { sigla: "BA", nome: "Bahia", regiao: "Nordeste" },
  { sigla: "CE", nome: "Ceará", regiao: "Nordeste" },
  { sigla: "DF", nome: "Distrito Federal", regiao: "Centro-Oeste" },
  { sigla: "ES", nome: "Espírito Santo", regiao: "Sudeste" },
  { sigla: "GO", nome: "Goiás", regiao: "Centro-Oeste" },
  { sigla: "MA", nome: "Maranhão", regiao: "Nordeste" },
  { sigla: "MT", nome: "Mato Grosso", regiao: "Centro-Oeste" },
  { sigla: "MS", nome: "Mato Grosso do Sul", regiao: "Centro-Oeste" },
  { sigla: "MG", nome: "Minas Gerais", regiao: "Sudeste" },
  { sigla: "PA", nome: "Pará", regiao: "Norte" },
  { sigla: "PB", nome: "Paraíba", regiao: "Nordeste" },
  { sigla: "PR", nome: "Paraná", regiao: "Sul" },
  { sigla: "PE", nome: "Pernambuco", regiao: "Nordeste" },
  { sigla: "PI", nome: "Piauí", regiao: "Nordeste" },
  { sigla: "RJ", nome: "Rio de Janeiro", regiao: "Sudeste" },
  { sigla: "RN", nome: "Rio Grande do Norte", regiao: "Nordeste" },
  { sigla: "RS", nome: "Rio Grande do Sul", regiao: "Sul" },
  { sigla: "RO", nome: "Rondônia", regiao: "Norte" },
  { sigla: "RR", nome: "Roraima", regiao: "Norte" },
  { sigla: "SC", nome: "Santa Catarina", regiao: "Sul" },
  { sigla: "SP", nome: "São Paulo", regiao: "Sudeste" },
  { sigla: "SE", nome: "Sergipe", regiao: "Nordeste" },
  { sigla: "TO", nome: "Tocantins", regiao: "Norte" },
];

export const SIGLAS_UF = UFS.map((u) => u.sigla);

export const ufValida = (uf: string | null | undefined): boolean =>
  !!uf && SIGLAS_UF.includes(uf.toUpperCase());

export const normalizarUf = (uf: string | null | undefined): string | null => {
  const s = (uf ?? "").trim().toUpperCase();
  return ufValida(s) ? s : null;
};

export const nomeUf = (uf: string | null | undefined): string =>
  UFS.find((u) => u.sigla === (uf ?? "").toUpperCase())?.nome ?? "—";

/** Rótulo padrão de localidade: "Cidade/UF". */
export const cidadeUf = (cidade: string | null | undefined, uf: string | null | undefined): string =>
  `${cidade ?? "—"}${ufValida(uf) ? `/${uf!.toUpperCase()}` : ""}`;
