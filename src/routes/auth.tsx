import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bus, Loader2, MailCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { TopNav } from "@/components/TopNav";
import {
  criarContaPorTelefone,
  enviarCodigoCadastro,
  enviarCodigoSms,
  verificarCodigoSms,
} from "@/lib/telefone.functions";



export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { modo?: Modo } => {
    const m = String(search['modo'] ?? "");
    const permitidos = ["entrar", "cadastrar", "recuperar", "telefone", "cadastro-telefone"];
    return permitidos.includes(m) ? { modo: m as Modo } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — RotaCerta" },
      {
        name: "description",
        content:
          "Acesse o RotaCerta como passageiro ou motorista: login, cadastro com perfil separado e recuperação de senha.",
      },
      { property: "og:title", content: "Entrar ou criar conta — RotaCerta" },
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

type Modo = "entrar" | "cadastrar" | "recuperar" | "telefone" | "cadastro-telefone";
type Perfil = "passageiro" | "motorista" | "frotista" | "administrativo";

/** Perfis que o cadastro cria diretamente. "administrativo" entra como passageiro
 *  e depende de aprovação do administrador master em /solicitar-admin. */
type PerfilBase = "passageiro" | "motorista" | "frotista";

const PERFIL_BASE: Record<Perfil, PerfilBase> = {
  passageiro: "passageiro",
  motorista: "motorista",
  frotista: "frotista",
  administrativo: "passageiro",
};

const DESTINO_POS_CADASTRO: Record<Perfil, "/biometria" | "/solicitar-admin"> = {
  passageiro: "/biometria",
  motorista: "/biometria",
  frotista: "/biometria",
  administrativo: "/solicitar-admin",
};

const ROTULO_PERFIL: Record<Perfil, string> = {
  passageiro: "Passageiro",
  motorista: "Motorista",
  frotista: "Frotista",
  administrativo: "Área administrativa",
};

const DESCRICAO_PERFIL: Record<Perfil, string> = {
  passageiro: "Reservar assentos e acordar o ponto de embarque.",
  motorista: "Publicar rotas, cadastrar veículo e receber corridas.",
  frotista: "Empresa (CNPJ) com frota — a partir de 6 veículos.",
  administrativo:
    "Colaborador da plataforma (admin secundário, gerente ou operacional). A conta é criada e o acesso administrativo passa por aprovação do administrador master.",
};


function AuthPage() {
  const navigate = useNavigate();
  const { modo: modoInicial } = Route.useSearch();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [perfil, setPerfil] = useState<Perfil>("passageiro");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");


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
        if (error) {
          if (/not confirmed|confirm/i.test(error.message)) {
            setAguardandoEmail(true);
            toast.error("Confirme seu e-mail antes de entrar.");
            return;
          }
          if (/invalid login credentials/i.test(error.message)) {
            toast.error(
              "E-mail ou senha inválidos. Se você criou a conta com o Google, entre pelo botão “Continuar com Google” ou defina uma senha em “Esqueci minha senha”.",
              { duration: 8000 },
            );
            return;
          }
          throw error;
        }
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/conta", replace: true });

      } else if (modo === "cadastrar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}${DESTINO_POS_CADASTRO[perfil]}`,
            data: {
              nome_completo: nome,
              telefone,
              municipio,
              perfil: PERFIL_BASE[perfil],
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success(
            perfil === "administrativo"
              ? "Conta criada! Agora solicite o acesso administrativo."
              : "Conta criada! Agora faça a biometria facial.",
          );
          navigate({ to: DESTINO_POS_CADASTRO[perfil], replace: true });

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

  async function reenviarConfirmacao() {
    setOcupado(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/conta` },
    });
    setOcupado(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Novo e-mail de confirmação enviado.");
  }

  async function pedirCodigoSms(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      await enviarCodigoSms({ data: { telefone } });
      setCodigoEnviado(true);
      toast.success("Se o número estiver cadastrado, você receberá um código por SMS.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o SMS.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarCodigoSms(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      const { tokenHash, email: emailConta } = await verificarCodigoSms({
        data: { telefone, codigo },
      });
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      setEmail(emailConta);
      toast.success("Telefone confirmado. Você está conectado.");
      navigate({ to: "/conta", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setOcupado(false);
    }
  }

  async function pedirCodigoCadastro(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      await enviarCodigoCadastro({ data: { telefone } });
      setCodigoEnviado(true);
      toast.success("Código enviado por SMS.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setOcupado(false);
    }
  }

  async function concluirCadastroPorTelefone(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      const { tokenHash } = await criarContaPorTelefone({
        data: {
          telefone,
          codigo,
          nome,
          municipio,
          perfil: PERFIL_BASE[perfil],
          ...(email.trim() ? { email: email.trim() } : {}),
        },
      });
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) throw error;
      toast.success(
        perfil === "administrativo"
          ? "Cadastro concluído! Agora solicite o acesso administrativo."
          : "Cadastro concluído! Agora faça a biometria facial.",
      );
      navigate({ to: DESTINO_POS_CADASTRO[perfil], replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
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

  const seletorPerfil = (
    <div className="mt-7">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary/50 p-1.5">
        {(["passageiro", "motorista", "frotista", "administrativo"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPerfil(p)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              perfil === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {ROTULO_PERFIL[p]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{DESCRICAO_PERFIL[perfil]}</p>
    </div>
  );


  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto flex max-w-md flex-col px-5 py-14">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Bus className="size-5" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">
          {modo === "entrar"
            ? "Entrar no RotaCerta"
            : modo === "cadastrar"
              ? "Criar conta por e-mail"
              : modo === "cadastro-telefone"
                ? "Criar conta por telefone"
                : modo === "telefone"
                  ? "Entrar por telefone"
                  : "Recuperar senha"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {modo === "recuperar"
            ? "Informe o e-mail cadastrado e enviaremos um link para definir uma nova senha."
            : modo === "telefone"
              ? "Enviamos um código de 6 dígitos por SMS para o telefone cadastrado na sua conta. Serve para entrar e também para recuperar o acesso quando você não lembra a senha."
              : modo === "cadastro-telefone"
                ? "Confirmamos seu número por SMS e criamos a conta já com o perfil escolhido. O e-mail é opcional. Em seguida você faz a biometria facial."
                : "Escolha seu perfil: passageiro, motorista, frotista (empresa com CNPJ) ou área administrativa (colaborador da plataforma). Cada perfil vê apenas as áreas e os dados que lhe pertencem."}
        </p>


        {!aguardandoEmail && (
          <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-secondary/50 p-1.5">
            <button
              type="button"
              onClick={() => {
                setModo("entrar");
                setCodigoEnviado(false);
                setCodigo("");
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                modo === "entrar" || modo === "telefone" || modo === "recuperar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Já tenho conta
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("cadastrar");
                setCodigoEnviado(false);
                setCodigo("");
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                modo === "cadastrar" || modo === "cadastro-telefone"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Criar conta nova
            </button>
          </div>
        )}

        {aguardandoEmail ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <MailCheck className="size-4 text-accent" /> Confirme seu e-mail
            </p>
            <p className="mt-2 text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. A conta só é liberada
              depois da confirmação — isso protege a plataforma contra cadastros falsos.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setAguardandoEmail(false);
                  setModo("entrar");
                }}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
              >
                Ir para o login
              </button>
              <button
                onClick={reenviarConfirmacao}
                disabled={ocupado || !email}
                className="rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Reenviar e-mail
              </button>
            </div>
          </div>
        ) : modo === "telefone" ? (
          <div className="mt-7">
            <form
              onSubmit={codigoEnviado ? confirmarCodigoSms : pedirCodigoSms}
              className="space-y-3"
            >
              <input
                className={campo}
                type="tel"
                placeholder="Telefone com DDD (ex.: 96 99999-0000)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={codigoEnviado}
                required
              />
              {codigoEnviado && (
                <input
                  className={campo}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Código de 6 dígitos"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  required
                />
              )}
              <button
                type="submit"
                disabled={ocupado}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
                {codigoEnviado ? "Confirmar código" : "Receber código por SMS"}
              </button>
            </form>
            {codigoEnviado && (
              <button
                onClick={() => {
                  setCodigoEnviado(false);
                  setCodigo("");
                }}
                className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Trocar número ou reenviar código
              </button>
            )}
            <button
              onClick={() => {
                setModo("entrar");
                setCodigoEnviado(false);
                setCodigo("");
              }}
              className="mt-6 block text-sm text-accent underline-offset-4 hover:underline"
            >
              Voltar para e-mail e senha
            </button>
          </div>
        ) : modo === "cadastro-telefone" ? (
          <div>
            {seletorPerfil}
            <form
              onSubmit={codigoEnviado ? concluirCadastroPorTelefone : pedirCodigoCadastro}
              className="mt-5 space-y-3"
            >
              <input
                className={campo}
                type="tel"
                placeholder="Telefone com DDD (ex.: 96 99999-0000)"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                disabled={codigoEnviado}
                required
              />
              {codigoEnviado && (
                <>
                  <input
                    className={campo}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Código de 6 dígitos recebido por SMS"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                  <input
                    className={campo}
                    placeholder="Nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    minLength={3}
                    required
                  />
                  <input
                    className={campo}
                    placeholder="Município / localidade"
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                  />
                  <input
                    className={campo}
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </>
              )}
              <button
                type="submit"
                disabled={ocupado}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {codigoEnviado ? "Concluir cadastro" : "Receber código por SMS"}
              </button>
            </form>
            {codigoEnviado && (
              <button
                onClick={() => {
                  setCodigoEnviado(false);
                  setCodigo("");
                }}
                className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Trocar número ou reenviar código
              </button>
            )}
            <button
              onClick={() => {
                setModo("cadastrar");
                setCodigoEnviado(false);
                setCodigo("");
              }}
              className="mt-6 block text-sm text-accent underline-offset-4 hover:underline"
            >
              Prefiro cadastrar por e-mail
            </button>
          </div>
        ) : (
          <>
            {modo === "cadastrar" && seletorPerfil}


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
                <button
                  onClick={() =>
                    setModo(modo === "cadastrar" ? "cadastro-telefone" : "telefone")
                  }
                  disabled={ocupado}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  <Smartphone className="size-4" />
                  {modo === "cadastrar"
                    ? "Cadastrar com código por SMS"
                    : "Entrar com código por SMS"}
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contas criadas pelo Google entram como passageiro; motorista e frotista escolhem o
                  perfil no cadastro. Depois de criar a conta, o próximo passo é a biometria facial
                  — obrigatória para motoristas e frotistas operarem.
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
              {modo === "recuperar" && (
                <>
                  <button
                    onClick={() => setModo("telefone")}
                    className="text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Não tenho acesso ao e-mail — recuperar por SMS
                  </button>
                  <br />
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
