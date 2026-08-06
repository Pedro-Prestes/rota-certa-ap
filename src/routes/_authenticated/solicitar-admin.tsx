import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, ShieldPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import { DESCRICAO_COLABORADOR, ROTULO_PERFIL } from "@/lib/acessos";

export const Route = createFileRoute("/_authenticated/solicitar-admin")({
  head: () => ({
    meta: [
      { title: "Solicitar acesso de administrador — RotaCerta" },
      {
        name: "description",
        content:
          "Envie sua solicitação para se tornar administrador do RotaCerta. A aprovação é feita pelo administrador master.",
      },
      { property: "og:title", content: "Solicitar acesso de administrador — RotaCerta" },
      {
        property: "og:description",
        content: "Cadastro de novos administradores do RotaCerta com aprovação do administrador master.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SolicitarAdmin,
});

type PerfilPedido = "admin" | "admin_secundario" | "gerente" | "operacional";

const PERFIS_PEDIDO: PerfilPedido[] = ["admin", "admin_secundario", "gerente", "operacional"];

const DESCRICAO_PEDIDO: Record<PerfilPedido, string> = {
  admin: "Administrador (não master) com acesso completo de administração.",
  ...DESCRICAO_COLABORADOR,
};

interface Solicitacao {
  id: string;
  perfil_solicitado: PerfilPedido;
  nome: string;
  email: string;
  justificativa: string;
  status: string;
  motivo: string | null;
  created_at: string;
  decidido_em: string | null;
}

const SELO: Record<string, { rotulo: string; classe: string; Icone: typeof Clock }> = {
  pendente: { rotulo: "Em análise", classe: "bg-secondary text-foreground", Icone: Clock },
  aprovada: { rotulo: "Aprovada", classe: "bg-primary text-primary-foreground", Icone: CheckCircle2 },
  recusada: { rotulo: "Recusada", classe: "bg-destructive text-destructive-foreground", Icone: XCircle },
};

function SolicitarAdmin() {
  const { user, carregando } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [perfilPedido, setPerfilPedido] = useState<PerfilPedido>("operacional");

  const minhas = useQuery({
    queryKey: ["minhas-solicitacoes-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_admin")
        .select("id, perfil_solicitado, nome, email, justificativa, status, motivo, created_at, decidido_em")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Solicitacao[];
    },
  });

  const pendente = (minhas.data ?? []).some((s) => s.status === "pendente");

  const enviar = useMutation({
    mutationFn: async () => {
      if (nome.trim().length < 3) throw new Error("Informe seu nome completo.");
      if (justificativa.trim().length < 15) {
        throw new Error("Descreva a justificativa com pelo menos 15 caracteres.");
      }
      const { error } = await supabase.from("solicitacoes_admin").insert({
        user_id: user!.id,
        nome: nome.trim(),
        email: user!.email ?? "",
        justificativa: justificativa.trim(),
        perfil_solicitado: perfilPedido,
        status: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["minhas-solicitacoes-admin"] });
      toast.success("Solicitação enviada para o administrador master.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (carregando) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-24 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldPlus className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Acesso administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Escolha o perfil administrativo desejado e envie sua solicitação. O administrador master aprova ou recusa o acesso.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Minha solicitação</h2>
          {pendente ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Você já tem uma solicitação em análise. Aguarde a decisão do administrador master.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Nome completo</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como você se identifica na plataforma"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">E-mail da conta</span>
                <input
                  value={user?.email ?? ""}
                  readOnly
                  className="rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground outline-none"
                />
              </label>
              <div className="grid gap-1.5 text-sm">
                <span className="font-semibold">Perfil desejado</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERFIS_PEDIDO.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPerfilPedido(p)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        perfilPedido === p
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary/60"
                      }`}
                    >
                      <span className="font-semibold">{ROTULO_PERFIL[p]}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {DESCRICAO_PEDIDO[p]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Justificativa</span>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={4}
                  placeholder="Explique por que você precisa de acesso administrativo"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                disabled={enviar.isPending}
                onClick={() => enviar.mutate()}
                className="justify-self-start rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {enviar.isPending ? "Enviando…" : "Enviar solicitação"}
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Histórico</h2>
          <ul className="mt-3 grid gap-3">
            {(minhas.data ?? []).map((s) => {
              const selo = SELO[s.status] ?? SELO["pendente"]!;
              return (
                <li key={s.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${selo.classe}`}
                    >
                      <selo.Icone className="size-3.5" /> {selo.rotulo}
                    </span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                      {ROTULO_PERFIL[s.perfil_solicitado]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Enviada em {new Date(s.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{s.justificativa}</p>
                  {s.motivo && (
                    <p className="mt-1 text-sm text-muted-foreground">Observação: {s.motivo}</p>
                  )}
                </li>
              );
            })}
            {(minhas.data ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma solicitação enviada até agora.
              </li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
