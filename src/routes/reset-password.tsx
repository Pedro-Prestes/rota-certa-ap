import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — RotaCerta" },
      {
        name: "description",
        content: "Crie uma nova senha para sua conta de passageiro ou motorista no RotaCerta.",
      },
      { property: "og:title", content: "Definir nova senha — RotaCerta" },
      { property: "og:description", content: "Redefinição de senha da conta RotaCerta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirma) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setOcupado(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/conta", replace: true });
  }

  const campo =
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-md px-5 py-14">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <KeyRound className="size-5" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">Definir nova senha</h1>
        {pronto ? (
          <form onSubmit={salvar} className="mt-6 space-y-3">
            <CampoSenha
              className={campo}
              placeholder="Nova senha"
              minLength={6}
              value={senha}
              onChange={setSenha}
              required
              autoComplete="new-password"
              mostrarForca
            />
            <CampoSenha
              className={campo}
              placeholder="Repita a nova senha"
              minLength={6}
              value={confirma}
              onChange={setConfirma}
              required
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={ocupado}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              {ocupado && <Loader2 className="size-4 animate-spin" />}Salvar senha
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Abra esta página pelo link enviado ao seu e-mail para poder redefinir a senha.
          </p>
        )}
      </main>
    </div>
  );
}
