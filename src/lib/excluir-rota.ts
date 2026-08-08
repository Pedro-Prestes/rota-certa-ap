import { supabase } from "@/integrations/supabase/client";

/**
 * Exclui uma rota publicada. Rotas com viagens já registradas não podem ser
 * apagadas (histórico operacional e financeiro) — nesses casos a rota deve ser
 * suspensa. Vínculos de veículos, pontos de embarque e plano de busca são
 * removidos em cascata pelo banco.
 */
export async function excluirRota(rotaId: string): Promise<void> {
  const { count, error: erroViagens } = await supabase
    .from("viagens")
    .select("id", { count: "exact", head: true })
    .eq("rota_id", rotaId);
  if (erroViagens) throw erroViagens;
  if ((count ?? 0) > 0) {
    throw new Error(
      "Esta rota já possui viagens registradas e não pode ser excluída. Suspenda a rota para retirá-la da oferta.",
    );
  }
  const { error } = await supabase.from("rotas").delete().eq("id", rotaId);
  if (error) throw error;
}
