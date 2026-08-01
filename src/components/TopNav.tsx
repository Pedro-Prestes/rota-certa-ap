import { Link, useRouterState } from "@tanstack/react-router";
import { Bus } from "lucide-react";

const links = [
  { to: "/", label: "Visão geral" },
  { to: "/passageiro", label: "Sou passageiro" },
  { to: "/motorista", label: "Sou motorista" },
] as const;

export function TopNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });

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
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                path === l.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
