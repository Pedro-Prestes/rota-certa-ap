/**
 * Matriz de acesso da plataforma por perfil.
 * Fonte única de verdade para navegação e guardas de página no cliente.
 * A autorização efetiva é sempre garantida pelas políticas do banco (RLS).
 */
export type Perfil =
  | "passageiro"
  | "motorista"
  | "frotista"
  | "admin"
  | "admin_secundario"
  | "gerente"
  | "operacional";

export const ROTULO_PERFIL: Record<Perfil, string> = {
  passageiro: "Passageiro",
  motorista: "Motorista",
  frotista: "Frotista",
  admin: "Administrador",
  admin_secundario: "Administrador secundário",
  gerente: "Gerente",
  operacional: "Operacional",
};

export const TODOS_PERFIS: Perfil[] = [
  "passageiro",
  "motorista",
  "frotista",
  "admin",
  "admin_secundario",
  "gerente",
  "operacional",
];

/** Colaboradores da área administrativa, aprovados pelo administrador master. */
export const PERFIS_COLABORADOR: Perfil[] = ["admin_secundario", "gerente", "operacional"];

/** Perfis com visão de gestão financeira/contábil. */
export const PERFIS_GESTAO: Perfil[] = ["admin_secundario", "gerente"];

export const DESCRICAO_COLABORADOR: Record<"admin_secundario" | "gerente" | "operacional", string> = {
  admin_secundario:
    "Apoia o administrador master: acompanha operação, contabilidade e atende ocorrências de pane.",
  gerente: "Visão de gestão: operação, pagamentos, estornos, custos e lançamentos contábeis.",
  operacional: "Acompanha rotas, viagens, embarques e ocorrências do dia a dia (somente leitura).",
};

export interface AreaPlataforma {
  to: string;
  label: string;
  /** Perfis com acesso à área. Admin master tem acesso a tudo. */
  perfis: Perfil[];
}

export const AREAS: AreaPlataforma[] = [
  { to: "/", label: "Visão geral", perfis: TODOS_PERFIS },
  { to: "/passageiro", label: "Sou passageiro", perfis: ["passageiro"] },
  { to: "/embarque", label: "Embarque", perfis: ["passageiro"] },
  { to: "/motorista", label: "Sou motorista", perfis: ["motorista", "frotista"] },
  { to: "/viagem", label: "Viagem ao vivo", perfis: ["motorista", "frotista"] },
  { to: "/carteira", label: "Carteira", perfis: ["motorista", "frotista"] },
  { to: "/sou-frotista", label: "Sou frotista (PJ)", perfis: TODOS_PERFIS },
  { to: "/area-administrativa", label: "Área administrativa", perfis: TODOS_PERFIS },
  { to: "/pagamentos", label: "Pagamentos", perfis: TODOS_PERFIS },
  { to: "/planos", label: "Planos", perfis: TODOS_PERFIS },
  { to: "/verificacao", label: "Idoneidade", perfis: TODOS_PERFIS },
  { to: "/biometria", label: "Biometria", perfis: ["passageiro", "motorista", "frotista"] },
  { to: "/auditoria", label: "Auditoria", perfis: TODOS_PERFIS },
  { to: "/solicitar-admin", label: "Acesso administrativo", perfis: TODOS_PERFIS },
  { to: "/colaborador", label: "Área do colaborador", perfis: PERFIS_COLABORADOR },
  { to: "/assistencia", label: "Assistência", perfis: ["admin", "admin_secundario", "operacional"] },
  { to: "/contabil", label: "Contábil", perfis: PERFIS_GESTAO },
  { to: "/admin", label: "Admin", perfis: ["admin"] },
];

/**
 * Painel do frotista: subárea dependente da vitrine "Sou frotista (PJ)".
 * Não aparece no menu principal — o acesso ocorre por dentro de /sou-frotista.
 */
export const SUBAREAS: Record<string, AreaPlataforma[]> = {
  "/sou-frotista": [
    { to: "/frotista", label: "Painel do frotista", perfis: ["motorista", "frotista"] },
  ],
};

/** Página antecessora de cada rota, até chegar à página principal ("/"). */
export const PAGINA_ANTERIOR: Record<string, string> = {
  "/passageiro": "/",
  "/embarque": "/passageiro",
  "/motorista": "/",
  "/viagem": "/motorista",
  "/carteira": "/motorista",
  "/sou-frotista": "/",
  "/frotista": "/sou-frotista",
  "/area-administrativa": "/",
  "/solicitar-admin": "/area-administrativa",
  "/colaborador": "/area-administrativa",
  "/assistencia": "/area-administrativa",
  "/contabil": "/area-administrativa",
  "/auditoria": "/area-administrativa",
  "/admin": "/area-administrativa",
  "/conta": "/",
  "/planos": "/conta",
  "/pagamentos": "/conta",
  "/verificacao": "/conta",
  "/biometria": "/conta",
  "/checkout-retorno": "/planos",
  "/auth": "/",
  "/cadastro": "/auth",
  "/reset-password": "/auth",
};

/** Retorna a rota antecessora, ou null na página principal. */
export function paginaAnterior(path: string): string | null {
  if (path === "/") return null;
  const limpo = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  // Páginas de recrutamento por estado (/seja-motorista/ap) voltam para a área do motorista.
  if (/^\/seja-motorista\/[a-zA-Z]{2}$/.test(limpo)) return "/motorista";
  return PAGINA_ANTERIOR[limpo] ?? "/";
}



/** Admin master enxerga tudo; os demais apenas as áreas do seu perfil. */
export function temAcesso(perfisDoUsuario: Perfil[], permitidos: Perfil[]): boolean {
  if (perfisDoUsuario.includes("admin")) return true;
  return permitidos.some((p) => perfisDoUsuario.includes(p));
}

export function areasVisiveis(perfisDoUsuario: Perfil[]): AreaPlataforma[] {
  return AREAS.filter((a) => temAcesso(perfisDoUsuario, a.perfis));
}
