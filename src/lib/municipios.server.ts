/**
 * Municípios brasileiros a partir da base oficial do IBGE.
 *
 * A consulta é feita no servidor, com cache em memória por UF, e degrada para
 * a lista semente do Amapá quando o serviço público está indisponível.
 */

import { localidadesAP } from "./dados";
import { normalizarUf } from "./ufs";

const IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades/estados";

const cache = new Map<string, { em: number; municipios: string[] }>();
const VALIDADE_MS = 24 * 60 * 60 * 1000;

const semente = (uf: string): string[] =>
  uf === "AP" ? [...new Set(localidadesAP.map((l) => l.municipio))].sort() : [];

export async function municipiosDaUf(ufBruta: string): Promise<string[]> {
  const uf = normalizarUf(ufBruta);
  if (!uf) throw new Error("Estado (UF) inválido.");

  const atual = cache.get(uf);
  if (atual && Date.now() - atual.em < VALIDADE_MS) return atual.municipios;

  try {
    const res = await fetch(`${IBGE}/${uf}/municipios?orderBy=nome`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const json = (await res.json()) as Array<{ nome?: string }>;
    const municipios = json
      .map((m) => (m.nome ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (municipios.length === 0) throw new Error("IBGE sem resultados");
    cache.set(uf, { em: Date.now(), municipios });
    return municipios;
  } catch (e) {
    console.error(`[ibge] falha ao listar municípios de ${uf}:`, (e as Error).message);
    const fallback = semente(uf);
    if (fallback.length === 0)
      throw new Error("Lista de municípios indisponível. Tente novamente.");
    return fallback;
  }
}
