import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { CapturaFacial } from "@/components/CapturaFacial";
import { useAuth } from "@/hooks/use-auth";
import {
  ROTULO_STATUS_BIOMETRIA,
  type PerfilBiometria,
  type ProvaVida,
  type StatusBiometria,
} from "@/lib/biometria";
import { enviarBiometriaFacial, verSelfieBiometria } from "@/utils/biometria.functions";

export const Route = createFileRoute("/_authenticated/biometria")({
  head: () => ({
    meta: [
      { title: "Biometria facial — RotaViva" },
      {
        name: "description",
        content:
          "Cadastro de passageiros e motoristas com biometria facial e prova de vida: selfie ao vivo, desafios de piscada e movimento, imagem em armazenamento privado e hash registrado na auditoria.",
      },
      { property: "og:title", content: "Biometria facial — RotaViva" },
      {
        property: "og:description",
        content: "Verificação facial com prova de vida para passageiros e motoristas do RotaViva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Biometria,
});

interface RegistroBiometria {
  id: string;
  perfil: PerfilBiometria;
  status: StatusBiometria;
  qualidade: number;
  imagem_hash: string | null;
  pendencias: string[];
  motivo: string | null;
  prova_vida: ProvaVida | null;
  created_at: string;
}

const corStatus: Record<StatusBiometria, string> = {
  aprovada: "bg-success/15 text-success",
  em_analise: "bg-accent/20 text-accent-foreground",
  reprovada: "bg-destructive/10 text-destructive",
};

function Biometria() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [perfil, setPerfil] = useState<PerfilBiometria>("motorista");
  const [capturando, setCapturando] = useState(false);

  const registros = useQuery({
    queryKey: ["biometrias", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verificacoes_biometricas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RegistroBiometria[];
    },
  });

  const aprovada = (registros.data ?? []).some((r) => r.status === "aprovada");

  const enviar = useMutation({
    mutationFn: async ({ imagem, provaVida }: { imagem: string; provaVida: ProvaVida }) => {
      const r = await enviarBiometriaFacial({ data: { perfil, imagem, provaVida } });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      setCapturando(false);
      if (r.status === "aprovada") toast.success("Biometria aprovada.");
      else if (r.status === "reprovada") toast.error("Biometria reprovada — repita a captura.");
      else toast.warning("Biometria em análise — veja as pendências.");
      qc.invalidateQueries({ queryKey: ["biometrias"] });
    },
    onError: (e: Error) => {
      setCapturando(false);
      toast.error(e.message);
    },
  });

  const abrirSelfie = async (id: string) => {
    const r = await verSelfieBiometria({ data: { id } });
    if ("error" in r) {
      toast.error(r.error as string);
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ScanFace className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Biometria facial</h1>
            <p className="text-sm text-muted-foreground">
              Selfie ao vivo com prova de vida. Obrigatória para motoristas receberem corridas.
            </p>
          </div>
        </div>

        <section
          className={`mt-8 rounded-2xl border p-5 ${
            aprovada ? "border-success/40 bg-success/5" : "border-border bg-card"
          }`}
        >
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            {aprovada ? (
              <ShieldCheck className="size-5 text-success" />
            ) : (
              <ShieldAlert className="size-5 text-destructive" />
            )}
            {aprovada ? "Identidade facial verificada" : "Biometria pendente"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {aprovada
              ? "Sua conta está liberada para operar como motorista e recebe o selo de verificado."
              : "Conclua a captura para liberar o painel do motorista. Passageiros podem usar o app, mas ganham o selo de verificado ao concluir."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["passageiro", "motorista"] as PerfilBiometria[]).map((p) => (
              <button
                key={p}
                onClick={() => setPerfil(p)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                  perfil === p
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {p === "motorista" ? "Sou motorista" : "Sou passageiro"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCapturando(true)}
            disabled={enviar.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <ScanFace className="size-4" /> Iniciar captura facial
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            Guardamos a selfie em armazenamento privado (visível só para você e o administrador) e
            registramos apenas o hash da imagem na cadeia de auditoria.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Histórico</h2>
          <div className="mt-4 space-y-2">
            {(registros.data ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {r.perfil === "motorista" ? "Motorista" : "Passageiro"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Qualidade {Number(r.qualidade)}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${corStatus[r.status]}`}
                  >
                    {ROTULO_STATUS_BIOMETRIA[r.status]}
                  </span>
                </div>
                {r.imagem_hash && (
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                    hash {r.imagem_hash}
                  </p>
                )}
                {r.pendencias?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.pendencias.map((p) => (
                      <li key={p} className="text-xs text-destructive">
                        • {p}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => void abrirSelfie(r.id)}
                  className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold"
                >
                  Ver selfie
                </button>
              </div>
            ))}
            {(registros.data ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma captura realizada ainda.
              </p>
            )}
          </div>
        </section>
      </main>

      {capturando && (
        <CapturaFacial
          perfil={perfil}
          onFechar={() => setCapturando(false)}
          onEnviar={async (imagem, provaVida) => {
            await enviar.mutateAsync({ imagem, provaVida });
          }}
        />
      )}
    </div>
  );
}
