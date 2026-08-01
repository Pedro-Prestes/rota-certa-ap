import { Link, useRouterState } from "@tanstack/react-router";
import { Bus, CircleUserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { to: "/", label: "Visão geral" },
  { to: "/passageiro", label: "Sou passageiro" },
  { to: "/motorista", label: "Sou motorista" },
  { to: "/pagamentos", label: "Pagamentos" },
] as const;

export function TopNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, carregando } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="size-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">RotaViva</span>
          <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground sm:inline">
            Amapá
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`hidden rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:inline-block ${
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
                className="ml-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold"
              >
                <CircleUserRound className="size-4" /> Minha conta
              </Link>
            ) : (
              <Link
                to="/auth"
                className="ml-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground"
              >
                Entrar
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
