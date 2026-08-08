import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodificar, replanejarEmbarque } from "@/lib/embarque.server";
import { normalizarUf } from "@/lib/ufs";


const uuid = /^[0-9a-fA-F-]{36}$/;
const dataISO = /^\d{4}-\d{2}-\d{2}$/;

/** Converte o endereço combinado em coordenadas georreferenciadas. */
export const localizarEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endereco: string; uf?: string }) => {
    const endereco = data.endereco?.trim() ?? "";
    if (endereco.length < 6) throw new Error("Descreva o ponto com rua, número e bairro.");
    if (endereco.length > 240) throw new Error("Endereço muito longo.");
    const uf = normalizarUf(data.uf);
    return { endereco, ...(uf ? { uf } : {}) };
  })
  .handler(async ({ data }) => {
    try {
      return await geocodificar(data.endereco, data.uf ?? null);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });


/**
 * Recalcula a rota de busca otimizada da rota/data e devolve o horário de
 * saída do motorista e o ETA de cada ponto acordado.
 */
export const planejarEmbarque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rotaId: string; dataViagem: string }) => {
    if (!uuid.test(data.rotaId ?? "")) throw new Error("Rota inválida.");
    if (!dataISO.test(data.dataViagem ?? "")) throw new Error("Data inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    try {
      return await replanejarEmbarque(context.supabase, data.rotaId, data.dataViagem);
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
