import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { paginaAnterior } from "@/lib/acessos";

/**
 * Botão "voltar" para a página antecessora, seguindo a hierarquia da plataforma
 * até chegar à página principal. Não aparece na página principal.
 */
export function BotaoVoltar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const anterior = paginaAnterior(path);
  if (!anterior) return null;

  return (
    <Link
      to={anterior}
      aria-label="Voltar para a página anterior"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> Voltar
    </Link>
  );
}
