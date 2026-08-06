import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Smartphone, UserPlus, ShieldCheck } from "lucide-react";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta no RotaCerta — passageiro, motorista ou frotista" },
      {
        name: "description",
        content:
          "Cadastre-se no RotaCerta por e-mail e senha ou por código SMS, sem depender do Google. Escolha seu perfil e conclua a biometria facial.",
      },
      { property: "og:title", content: "Criar conta no RotaCerta" },
      {
        property: "og:description",
        content:
          "Cadastro de passageiro, motorista ou frotista por e-mail e senha ou por código enviado via SMS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <UserPlus className="size-5" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">Criar uma conta nova</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Você não precisa usar o Google. Cadastre-se com qualquer e-mail (Hotmail, Outlook, Yahoo,
          e-mail corporativo) definindo sua própria senha, ou receba um código por SMS no seu
          telefone.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            to="/auth"
            search={{ modo: "cadastrar" as const }}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
          >
            <Mail className="size-5 text-accent" />
            <h2 className="mt-3 text-lg font-semibold">Com e-mail e senha</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe nome, telefone, município, e-mail e uma senha. Escolha o perfil: passageiro,
              motorista, frotista ou área administrativa.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-accent">
              Cadastrar por e-mail →
            </span>
          </Link>

          <Link
            to="/auth"
            search={{ modo: "cadastro-telefone" as const }}
            className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
          >
            <Smartphone className="size-5 text-accent" />
            <h2 className="mt-3 text-lg font-semibold">Com código por SMS</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirmamos seu número por SMS e criamos a conta com o perfil escolhido. O e-mail é
              opcional.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-accent">
              Cadastrar por telefone →
            </span>
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-6 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-accent" /> Próximo passo após o cadastro
          </p>
          <p className="mt-2 text-muted-foreground">
            Toda conta passa pela biometria facial. Para motorista e frotista ela é obrigatória antes
            de operar rotas; para passageiro garante segurança no embarque.
          </p>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            to="/auth"
            search={{ modo: "entrar" as const }}
            className="text-accent underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </main>
    </div>
  );
}
