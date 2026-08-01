import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bus, Loader2, MailCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { TopNav } from "@/components/TopNav";
import { enviarCodigoSms, verificarCodigoSms } from "@/lib/telefone.functions";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — RotaViva" },
      {
        name: "description",
        content:
          "Acesse o RotaViva como passageiro ou motorista: login, cadastro com perfil separado e recuperação de senha.",
      },
      { property: "og:title", content: "Entrar ou criar conta — RotaViva" },
      {
        property: "og:description",
        content: "Login e cadastro de passageiros e motoristas do transporte agendado no Amapá.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Modo = "entrar" | "cadastrar" | "recuperar";
type Perfil = "passageiro" | "motorista";

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("entrar");
  const [perfil, setPerfil] = useState<Perfil>("passageiro");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/conta", replace: true });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/conta", replace: true });
      } else if (modo === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/conta`,
            data: {
              nome_completo: nome,
              telefone,
              municipio,
              perfil,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Conta criada!");
          navigate({ to: "/conta", replace: true });
        } else {
          setAguardandoEmail(true);
          toast.success("Confirme seu e-mail para ativar a conta.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de redefinição para o seu e-mail.");
        setModo("entrar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  }

  async function entrarComGoogle() {
    setOcupado(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setOcupado(false);
      toast.error("Falha ao entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/conta", replace: true });
  }

  const campo =
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors focus:border-accent";

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto flex max-w-md flex-col px-5 py-14">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Bus className="size-5" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">
          {modo === "entrar"
            ? "Entrar no RotaViva"
            : modo === "cadastrar"
              ? "Criar conta"
              : "Recuperar senha"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {modo === "recuperar"
            ? "Informe o e-mail cadastrado e enviaremos um link para definir uma nova senha."
            : "Um acesso, dois perfis: passageiro para reservar assentos, motorista para publicar rotas."}
        </p>

        {aguardandoEmail ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm">
            <p className="font-semibold">Confira seu e-mail</p>
            <p className="mt-2 text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar,
              volte aqui e faça login.
            </p>
            <button
              onClick={() => {
                setAguardandoEmail(false);
                setModo("entrar");
              }}
              className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <>
            {modo === "cadastrar" && (
              <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary/50 p-1.5">
                {(["passageiro", "motorista"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPerfil(p)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                      perfil === p
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sou {p}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={enviar} className="mt-5 space-y-3">
              {modo === "cadastrar" && (
                <>
                  <input
                    className={campo}
                    placeholder="Nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                  <input
                    className={campo}
                    placeholder="Telefone (WhatsApp)"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                  <input
                    className={campo}
                    placeholder="Município / localidade"
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                  />
                </>
              )}
              <input
                className={campo}
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {modo !== "recuperar" && (
                <input
                  className={campo}
                  type="password"
                  placeholder="Senha"
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              )}
              <button
                type="submit"
                disabled={ocupado}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {ocupado && <Loader2 className="size-4 animate-spin" />}
                {modo === "entrar"
                  ? "Entrar"
                  : modo === "cadastrar"
                    ? "Criar conta"
                    : "Enviar link de recuperação"}
              </button>
            </form>

            {modo !== "recuperar" && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  onClick={entrarComGoogle}
                  disabled={ocupado}
                  className="w-full rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  Continuar com o Google
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contas criadas pelo Google entram como passageiro; o perfil de motorista pode ser
                  ativado depois no cadastro de veículo.
                </p>
              </>
            )}

            <div className="mt-7 space-y-2 text-sm">
              {modo === "entrar" && (
                <>
                  <button
                    onClick={() => setModo("cadastrar")}
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    Ainda não tenho conta
                  </button>
                  <br />
                  <button
                    onClick={() => setModo("recuperar")}
                    className="text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </>
              )}
              {modo !== "entrar" && (
                <button
                  onClick={() => setModo("entrar")}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Já tenho conta — entrar
                </button>
              )}
            </div>
          </>
        )}

        <Link to="/" className="mt-10 text-xs text-muted-foreground hover:text-foreground">
          ← Voltar para a visão geral
        </Link>
      </main>
    </div>
  );
}
