import { useEffect, useRef } from "react";
import { liberarBip, tocarBip, type NomeBip } from "@/lib/bip";

/**
 * Toca o bip quando aparecem itens novos na lista observada.
 *
 * A primeira leitura só memoriza o que já existia (não avisa sobre histórico);
 * a partir daí, qualquer identificador inédito dispara a assinatura sonora.
 */
export function useBipDeNovidades(ids: string[], bip: NomeBip, ativo = true) {
  const conhecidos = useRef<Set<string> | null>(null);

  useEffect(() => {
    liberarBip();
  }, []);

  useEffect(() => {
    if (!ativo) return;
    if (conhecidos.current === null) {
      conhecidos.current = new Set(ids);
      return;
    }
    const novos = ids.filter((id) => !conhecidos.current!.has(id));
    conhecidos.current = new Set(ids);
    if (novos.length > 0) tocarBip(bip);
  }, [ids.join("|"), bip, ativo]);
}
