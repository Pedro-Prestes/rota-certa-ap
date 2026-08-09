import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bus, CircleUserRound, Compass, Menu } from "lucide-react";
import { useAcesso } from "@/hooks/use-auth";
import { abrirTour } from "@/lib/tour";
import { AREAS, SUBAREAS, areasVisiveis, temAcesso } from "@/lib/acessos";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Áreas em destaque no topo em telas grandes; o menu completo fica no botão. */
const DESTAQUE = ["/passageiro", "/motorista", "/sou-frotista", "/area-administrativa"];

export function TopNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, carregando, perfis } = useAcesso();
  const [aberto, setAberto] = useState(false);

  // Visitante vê apenas as vitrines públicas.
  const links = user
    ? areasVisiveis(perfis)
    : AREAS.filter((a) =>
        ["/", "/passageiro", "/motorista", "/sou-frotista", "/area-administrativa"].includes(a.to),
      );

  const destaques = links.filter((l) => DESTAQUE.includes(l.to));

  // Subáreas liberadas (ex.: painel do frotista dentro de "Sou frotista").
  const subareas = Object.entries(SUBAREAS).flatMap(([pai, filhos]) =>
    links.some((l) => l.to === pai)
      ? filhos.filter((f) => (user ? temAcesso(perfis, f.perfis) : false))
      : [],
  );

  const itensMenu = [...links, ...subareas];

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 sm:px-5">
        <div className="flex shrink-0 items-center gap-2">
          <BotaoVoltar />
        </div>

        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="size-4" />
          </span>
          <span className="truncate font-display text-lg font-bold tracking-tight">RotaCerta</span>
          <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground lg:inline">
            Brasil
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {destaques.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`hidden rounded-full px-3 py-1.5 text-sm font-medium transition-colors lg:inline-block ${
                path === l.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {!carregando &&
            (user ? (
              <Link
                to="/conta"
                data-tour="conta"
                aria-label="Minha conta"
                className="ml-1 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold"
              >
                <CircleUserRound className="size-4" />
                <span className="hidden sm:inline">Minha conta</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/cadastro"
                  data-tour="criar-conta"
                  className="hidden rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold sm:inline-block"
                >
                  Criar conta
                </Link>
                <Link
                  to="/auth"
                  data-tour="entrar"
                  className="ml-1 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground sm:px-4"
                >
                  Entrar
                </Link>
              </>
            ))}

          <Sheet open={aberto} onOpenChange={setAberto}>
            <SheetTrigger asChild>
              <button
                type="button"
                data-tour="menu"
                aria-label="Abrir menu de áreas"
                className="ml-1 inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
              >
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto p-0">
              <SheetHeader className="border-b border-border px-5 py-4 text-left">
                <SheetTitle className="text-base">Áreas da plataforma</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col p-3">
                {itensMenu.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setAberto(false)}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                      path === l.to
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
                {!user && (
                  <Link
                    to="/cadastro"
                    onClick={() => setAberto(false)}
                    className="mt-2 rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground"
                  >
                    Criar conta
                  </Link>
                )}
                {user && (
                  <Link
                    to="/conta"
                    onClick={() => setAberto(false)}
                    className="mt-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
                  >
                    Minha conta
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    setTimeout(abrirTour, 120);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold"
                >
                  <Compass className="size-4" /> Como usar o RotaCerta
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
