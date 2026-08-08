import { createServerFn } from "@tanstack/react-start";
import { municipiosDaUf } from "@/lib/municipios.server";
import { normalizarUf } from "@/lib/ufs";

/** Lista pública dos municípios de uma UF (base IBGE). */
export const listarMunicipios = createServerFn({ method: "POST" })
  .inputValidator((data: { uf: string }) => {
    const uf = normalizarUf(data?.uf);
    if (!uf) throw new Error("Estado (UF) inválido.");
    return { uf };
  })
  .handler(async ({ data }) => {
    try {
      return { uf: data.uf, municipios: await municipiosDaUf(data.uf) };
    } catch (e) {
      return { uf: data.uf, municipios: [] as string[], error: (e as Error).message };
    }
  });
