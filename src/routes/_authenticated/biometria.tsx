import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ScanFace, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { CapturaFacial } from "@/components/CapturaFacial";
import { DocumentosCredenciamento } from "@/components/DocumentosCredenciamento";
import { Button } from "@/components/ui/button";
import { useAcesso, useAuth } from "@/hooks/use-auth";
import { ROTULO_STATUS_BIOMETRIA, type PerfilBiometria, type ProvaVida, type StatusBiometria } from "@/lib/biometria";
import { enviarBiometriaFacial, verSelfieBiometria } from "@/utils/biometria.functions";
import { GuardaPerfil } from "@/components/GuardaPerfil";

export const Route = createFileRoute("/_authenticated/biometria")({
  head: () => ({ meta: [
    { title: "Biometria facial — RotaCerta" },
    { name: "description", content: "Verificação facial assistida e envio seguro de documentos para passageiros e motoristas do RotaCerta." },
    { property: "og:title", content: "Biometria facial — RotaCerta" },
    { property: "og:description", content: "Verificação facial assistida e análise segura de documentos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BiometriaProtegido,
});

interface RegistroBiometria { id: string; perfil: PerfilBiometria; status: StatusBiometria; pendencias: string[]; created_at: string }
const corStatus: Record<StatusBiometria, string> = { aprovada: "bg-success/15 text-success", em_analise: "bg-accent/20 text-accent-foreground", reprovada: "bg-destructive/10 text-destructive" };

function Biometria() {
  const { user } = useAuth();
  const { ehMotorista, ehFrotista } = useAcesso();
  const qc = useQueryClient();
  const perfil: PerfilBiometria = ehMotorista || ehFrotista ? "motorista" : "passageiro";
  const [capturando, setCapturando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const registros = useQuery({
    queryKey: ["biometrias", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from("verificacoes_biometricas").select("id, perfil, status, pendencias, created_at").eq("perfil", perfil).order("created_at", { ascending: false }); if (error) throw error; return (data ?? []) as RegistroBiometria[]; },
  });
  const aprovada = (registros.data ?? []).some((r) => r.status === "aprovada");
  const enviar = useMutation({
    mutationFn: async ({ imagem, provaVida }: { imagem: string; provaVida: ProvaVida }) => { const r = await enviarBiometriaFacial({ data: { perfil, imagem, provaVida } }); if ("error" in r) throw new Error(r.error as string); return r; },
    onSuccess: (r) => { setCapturando(false); r.status === "aprovada" ? toast.success("Biometria aprovada. Você pode continuar.") : toast.warning("A captura precisa de análise. Você também pode enviar seus documentos."); void qc.invalidateQueries({ queryKey: ["biometrias"] }); },
    onError: (e: Error) => { setCapturando(false); toast.error(e.message); },
  });
  const abrirSelfie = async (id: string) => { const r = await verSelfieBiometria({ data: { id } }); if ("error" in r) toast.error(r.error as string); else window.open(r.url, "_blank", "noopener,noreferrer"); };

  return <div className="min-h-screen bg-background"><TopNav /><main className="mx-auto max-w-4xl px-5 py-10">
    <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ScanFace /></span><div><h1 className="font-display text-2xl font-bold">Confirme sua identidade</h1><p className="text-sm text-muted-foreground">Siga as instruções da câmera. Se precisar, envie documentos para análise manual.</p></div></div>
    <section className={`mt-8 rounded-lg border p-5 ${aprovada ? "border-success/40 bg-success/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">{aprovada ? <ShieldCheck className="size-5 text-success" /> : <ShieldAlert className="size-5 text-accent" />}<div><h2 className="font-display text-lg font-bold">{aprovada ? "Identidade confirmada" : "Primeiro, faça a verificação facial"}</h2><p className="mt-1 text-sm text-muted-foreground">{aprovada ? "Esta etapa foi concluída." : "Leva cerca de um minuto. Prepare o ambiente antes de liberar a câmera."}</p></div></div>
      {!aprovada && <Button onClick={() => setCapturando(true)} disabled={enviar.isPending} className="mt-5"><ScanFace /> Começar biometria</Button>}
      {!aprovada && <DocumentosCredenciamento perfil={perfil} />}
    </section>
    <section className="mt-6 rounded-lg border border-border bg-card p-5"><Button variant="ghost" className="w-full justify-between" onClick={() => setHistoricoAberto((v) => !v)}>Histórico de tentativas <ChevronDown className={`transition-transform ${historicoAberto ? "rotate-180" : ""}`} /></Button>{historicoAberto && <div className="mt-4 space-y-2">{(registros.data ?? []).map((r) => <div key={r.id} className="rounded-lg border border-border p-4 text-sm"><div className="flex flex-wrap items-center gap-2"><span>{new Date(r.created_at).toLocaleString("pt-BR")}</span><span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${corStatus[r.status]}`}>{ROTULO_STATUS_BIOMETRIA[r.status]}</span></div>{r.pendencias?.map((p) => <p key={p} className="mt-2 text-xs text-destructive">• {p}</p>)}<Button size="sm" variant="outline" className="mt-3" onClick={() => void abrirSelfie(r.id)}>Ver selfie</Button></div>)}{!registros.data?.length && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma tentativa realizada.</p>}</div>}</section>
  </main>{capturando && <CapturaFacial perfil={perfil} onFechar={() => setCapturando(false)} onEnviar={async (imagem, provaVida) => { await enviar.mutateAsync({ imagem, provaVida }); }} />}</div>;
}
function BiometriaProtegido() { return <GuardaPerfil perfis={["passageiro", "motorista", "frotista"]}><Biometria /></GuardaPerfil>; }
