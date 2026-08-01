import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { HASH_GENESE, hashBloco } from "./blockchain";

/**
 * Anexa um bloco ao final da cadeia. O bloco recebe o hash do bloco anterior,
 * de modo que qualquer alteração posterior invalida a verificação pública.
 */
export async function registrarEvento(params: {
  evento: string;
  dados: Record<string, unknown>;
  corridaId?: string | null;
  registradoPor?: string | null;
}): Promise<{ indice: number; hash: string } | null> {
  const { data: ultimo } = await supabaseAdmin
    .from("blockchain_blocos")
    .select("indice, hash")
    .order("indice", { ascending: false })
    .limit(1)
    .maybeSingle();

  const indice = (ultimo?.indice ?? -1) + 1;
  const hash_anterior = ultimo?.hash ?? HASH_GENESE;
  const dados = { ...params.dados, registrado_em: new Date().toISOString() };
  const hash = await hashBloco({ indice, hash_anterior, evento: params.evento, dados });

  const { error } = await supabaseAdmin.from("blockchain_blocos").insert({
    indice,
    hash_anterior,
    hash,
    evento: params.evento,
    dados,
    corrida_id: params.corridaId ?? null,
    registrado_por: params.registradoPor ?? null,
  });

  if (error) {
    console.error("Falha ao registrar bloco:", error.message);
    return null;
  }
  return { indice, hash };
}
