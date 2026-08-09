import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Loader2, Search, ShieldCheck, ShieldPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import { brl, resumoCorrida, type Corrida, type Pagamento } from "@/lib/pagamentos";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — RotaCerta" },
      {
        name: "description",
        content:
          "Painel do administrador master do RotaCerta: usuários, perfis de acesso, corridas e faturamento consolidado.",
      },
      { property: "og:title", content: "Administração — RotaCerta" },
      {
        property: "og:description",
        content: "Gestão de usuários, perfis e faturamento consolidado do RotaCerta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Admin,
});

type Papel =
  | "passageiro"
  | "motorista"
  | "frotista"
  | "admin"
  | "admin_secundario"
  | "gerente"
  | "operacional";
const PAPEIS: { id: Papel; rotulo: string }[] = [
  { id: "passageiro", rotulo: "Passageiro" },
  { id: "motorista", rotulo: "Motorista" },
  { id: "frotista", rotulo: "Frotista" },
  { id: "admin", rotulo: "Administrador" },
  { id: "admin_secundario", rotulo: "Admin. secundário" },
  { id: "gerente", rotulo: "Gerente" },
  { id: "operacional", rotulo: "Operacional" },
];

interface Perfil {
  id: string;
  nome_completo: string;
  telefone: string | null;
  municipio: string | null;
  created_at: string;
}

function Admin() {
  const { user, carregando } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const ehAdmin = useQuery({
    queryKey: ["ehAdmin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });

  const autorizado = ehAdmin.data === true;

  const perfis = useQuery({
    queryKey: ["admin-perfis"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo, telefone, municipio, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const papeis = useQuery({
    queryKey: ["admin-papeis"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role: Papel }[];
    },
  });

  const masters = useQuery({
    queryKey: ["admin-masters"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase.from("admins_master").select("email");
      if (error) throw error;
      return (data ?? []).map((m) => m.email);
    },
  });

  const ehMaster = useQuery({
    queryKey: ["ehMaster", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("eh_admin_master", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });

  const solicitacoes = useQuery({
    queryKey: ["admin-solicitacoes"],
    enabled: ehMaster.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes_admin")
        .select("id, user_id, perfil_solicitado, nome, email, justificativa, status, motivo, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        user_id: string;
        perfil_solicitado: Papel;
        nome: string;
        email: string;
        justificativa: string;
        status: string;
        motivo: string | null;
        created_at: string;
      }[];
    },
  });

  const decidir = useMutation({
    mutationFn: async ({
      id,
      status,
      motivo,
    }: {
      id: string;
      status: "aprovada" | "recusada";
      motivo?: string | undefined;
    }) => {
      const { error } = await supabase
        .from("solicitacoes_admin")
        .update({
          status,
          motivo: motivo ?? null,
          decidido_por: user!.id,
          decidido_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-solicitacoes"] });
      qc.invalidateQueries({ queryKey: ["admin-papeis"] });
      toast.success(v.status === "aprovada" ? "Administrador aprovado" : "Solicitação recusada");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const corridas = useQuery({
    queryKey: ["admin-corridas"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corridas")
        .select("*")
        .order("data_corrida", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Corrida[];
    },
  });

  const pagamentos = useQuery({
    queryKey: ["admin-pagamentos"],
    enabled: autorizado,
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*");
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });

  const alterarPapel = useMutation({
    mutationFn: async ({ userId, papel, ativo }: { userId: string; papel: Papel; ativo: boolean }) => {
      if (ativo) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: papel });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", papel);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-papeis"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totais = useMemo(() => {
    const lista = corridas.data ?? [];
    const pgs = pagamentos.data ?? [];
    let bruto = 0;
    let recebido = 0;
    let taxas = 0;
    let liquido = 0;
    for (const c of lista) {
      const r = resumoCorrida(
        c,
        pgs.filter((p) => p.corrida_id === c.id),
      );
      bruto += r.bruto;
      recebido += r.recebido;
      taxas += r.taxas;
      liquido += r.liquidoMotorista;
    }
    return { bruto, recebido, taxas, liquido, corridas: lista.length };
  }, [corridas.data, pagamentos.data]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const lista = perfis.data ?? [];
    if (!t) return lista;
    return lista.filter(
      (p) =>
        p.nome_completo.toLowerCase().includes(t) ||
        (p.telefone ?? "").toLowerCase().includes(t) ||
        (p.municipio ?? "").toLowerCase().includes(t),
    );
  }, [perfis.data, busca]);

  const papeisDe = (id: string) => (papeis.data ?? []).filter((r) => r.user_id === id).map((r) => r.role);

  if (carregando || ehAdmin.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-24 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando painel…
        </div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <main className="mx-auto max-w-3xl px-5 py-24 text-center">
          <ShieldCheck className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Área restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta não tem permissão de administrador neste ambiente.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Crown className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Administração</h1>
            <p className="text-sm text-muted-foreground">
              Usuários, perfis de acesso e faturamento consolidado.
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { r: "Corridas", v: String(totais.corridas) },
            { r: "Faturamento bruto", v: brl(totais.bruto) },
            { r: "Recebido", v: brl(totais.recebido) },
            { r: "Taxas", v: brl(totais.taxas) },
            { r: "Líquido motoristas", v: brl(totais.liquido) },
          ].map((k) => (
            <div key={k.r} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground">{k.r}</p>
              <p className="mt-1 font-display text-xl font-bold">{k.v}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Users className="size-4" /> Usuários ({filtrados.length})
            </h2>
            <label className="ml-auto flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, telefone ou município"
                className="w-64 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Nome</th>
                  <th className="py-2">Telefone</th>
                  <th className="py-2">Município</th>
                  <th className="py-2">Perfis</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const atuais = papeisDe(p.id);
                  return (
                    <tr key={p.id} className="border-t border-border/70">
                      <td className="py-3 font-medium">{p.nome_completo || "—"}</td>
                      <td className="py-3 text-muted-foreground">{p.telefone || "—"}</td>
                      <td className="py-3 text-muted-foreground">{p.municipio || "—"}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {PAPEIS.map((papel) => {
                            const ativo = atuais.includes(papel.id);
                            return (
                              <button
                                key={papel.id}
                                type="button"
                                disabled={alterarPapel.isPending}
                                onClick={() =>
                                  alterarPapel.mutate({ userId: p.id, papel: papel.id, ativo: !ativo })
                                }
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                                  ativo
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                {papel.rotulo}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {ehMaster.data === true && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ShieldPlus className="size-4" /> Solicitações de acesso administrativo
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A aprovação concede exatamente o perfil pedido (administrador, administrador secundário, gerente ou operacional) à conta solicitante.
            </p>
            <ul className="mt-4 grid gap-3">
              {(solicitacoes.data ?? []).map((s) => (
                <li key={s.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.nome}</span>
                    <span className="text-sm text-muted-foreground">{s.email}</span>
                    <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                      {PAPEIS.find((p) => p.id === s.perfil_solicitado)?.rotulo ?? s.perfil_solicitado}
                    </span>
                    <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                      {s.status === "pendente"
                        ? "Em análise"
                        : s.status === "aprovada"
                          ? "Aprovada"
                          : "Recusada"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.justificativa}</p>
                  {s.status === "pendente" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={decidir.isPending}
                        onClick={() => decidir.mutate({ id: s.id, status: "aprovada" })}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={decidir.isPending}
                        onClick={() => {
                          const motivo = window.prompt("Motivo da recusa (opcional)");
                          decidir.mutate({ id: s.id, status: "recusada", motivo: motivo ?? "" });
                        }}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-60"
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {(solicitacoes.data ?? []).length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma solicitação recebida.
                </li>
              )}
            </ul>
          </section>
        )}



        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <ShieldCheck className="size-4" /> Administradores master
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estes e-mails recebem o perfil de administrador automaticamente ao criar a conta.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(masters.data ?? []).map((email) => (
              <li
                key={email}
                className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground"
              >
                {email}
              </li>
            ))}
          </ul>
        </section>

        <PainelPromocao />
      </main>
    </div>
  );
}

/** Lançamento promocional: vagas por estado e premiados. */
function PainelPromocao() {
  const qc = useQueryClient();
  const painel = useQuery({
    queryKey: ["promo-painel"],
    queryFn: () => consultarPainelPromo(),
  });
  const alternar = useMutation({
    mutationFn: (ativa: boolean) => alternarCampanhaPromo({ data: { ativa } }),
    onSuccess: () => {
      toast.success("Campanha atualizada.");
      void qc.invalidateQueries({ queryKey: ["promo-painel"] });
      void qc.invalidateQueries({ queryKey: ["promo-vagas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (painel.isLoading) {
    return (
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    );
  }
  if (!painel.data) return null;
  const usadas = painel.data.ufs.reduce((s, u) => s + u.usadas, 0);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Gift className="size-4" /> Lançamento promocional
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {painel.data.vagasPorUf} vagas por estado · {painel.data.dias} dias de Motorista Pro
            gratuitos · {usadas} concedidas
          </p>
        </div>
        <button
          onClick={() => alternar.mutate(!painel.data.ativa)}
          disabled={alternar.isPending}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {painel.data.ativa ? "Encerrar campanha" : "Reativar campanha"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {painel.data.ufs.map((u) => (
          <span
            key={u.uf}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              u.restantes > 0 ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {u.uf} · {u.usadas}/{painel.data!.vagasPorUf}
          </span>
        ))}
      </div>

      {painel.data.premiados.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Estado</th>
                <th className="py-2">Vaga</th>
                <th className="py-2">Concedida</th>
                <th className="py-2">Válida até</th>
                <th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {painel.data.premiados.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2 font-semibold">{p.uf}</td>
                  <td className="py-2">{p.posicao}º</td>
                  <td className="py-2">{new Date(p.concedida_em).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2">{new Date(p.expira_em).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
