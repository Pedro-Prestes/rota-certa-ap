import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Loader2, Search, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { abrirDocumentoCredenciamento, decidirCredenciamento, listarCredenciamentosAdmin } from "@/utils/credenciamento-documentos.functions";

const ETAPAS = [{ id: "biometria", nome: "Biometria" }, { id: "documentos", nome: "Documentos" }, { id: "cnh", nome: "CNH" }, { id: "veiculo", nome: "Veículo" }, { id: "total", nome: "Todo o credenciamento" }] as const;
type Etapa = (typeof ETAPAS)[number]["id"];
type Acao = "aprovar" | "correcao" | "rejeitar" | "excluir" | "reiniciar";
interface Pendente { userId: string; perfil: "passageiro" | "motorista"; etapa: Etapa; acao: Acao; nome: string }

export function CentralCredenciamento() {
  const qc = useQueryClient();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [motivo, setMotivo] = useState("");
  const lista = useQuery({ queryKey: ["central-credenciamento", termo], queryFn: () => listarCredenciamentosAdmin({ data: { termo } }) });
  const decidir = useMutation({
    mutationFn: async (item: Pendente) => {
      const resposta = await decidirCredenciamento({ data: { userId: item.userId, perfil: item.perfil, etapa: item.etapa, acao: item.acao, motivo } });
      if ("error" in resposta) throw new Error(resposta.error as string);
      return resposta;
    },
    onSuccess: () => { toast.success("Decisão registrada e credenciamento atualizado."); setPendente(null); setMotivo(""); void qc.invalidateQueries({ queryKey: ["central-credenciamento"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (lista.data?.error) return null;
  const cadastros = lista.data?.cadastros ?? [];
  const abrirDocumento = async (id: string) => { const resposta = await abrirDocumentoCredenciamento({ data: { id } }); if ("error" in resposta) toast.error(resposta.error as string); else window.open(resposta.url, "_blank", "noopener,noreferrer"); };
  const iniciar = (userId: string, perfil: "passageiro" | "motorista", etapa: Etapa, acao: Acao, nome: string) => { setPendente({ userId, perfil, etapa, acao, nome }); setMotivo(""); };
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="size-5" /> Central de credenciamento</h2><p className="mt-1 text-sm text-muted-foreground">Analise documentos e decida cada etapa sem excluir a conta da pessoa.</p></div>
        <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"><Search className="size-4 text-muted-foreground" /><input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar nome ou e-mail" className="w-56 bg-transparent text-sm outline-none" /></label>
      </div>
      {lista.isLoading ? <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando cadastros…</p> : (
        <div className="mt-4 space-y-3">
          {cadastros.map((cadastro) => {
            const perfil = cadastro.perfis.includes("motorista") ? "motorista" : "passageiro";
            return <article key={cadastro.userId} className="rounded-lg border border-border">
              <button type="button" onClick={() => setAberto(aberto === cadastro.userId ? null : cadastro.userId)} className="flex w-full items-center gap-3 p-4 text-left">
                <div className="min-w-0 flex-1"><p className="font-semibold">{cadastro.nome}</p><p className="truncate text-xs text-muted-foreground">{cadastro.email} · {perfil === "motorista" ? "Motorista" : "Passageiro"}</p></div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{cadastro.documentos.length} documento(s)</span><ChevronDown className={`size-4 transition-transform ${aberto === cadastro.userId ? "rotate-180" : ""}`} />
              </button>
              {aberto === cadastro.userId && <div className="border-t border-border p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div><h3 className="text-sm font-bold">Documentos enviados</h3><div className="mt-2 space-y-2">{cadastro.documentos.map((doc) => <button key={doc.id} type="button" onClick={() => void abrirDocumento(doc.id)} className="flex w-full items-center justify-between rounded-md bg-secondary p-3 text-left text-xs"><span>{doc.tipo.replaceAll("_", " ")} · {doc.status}</span><ExternalLink className="size-3.5" /></button>)}{cadastro.documentos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum documento enviado.</p>}</div></div>
                  <div><h3 className="text-sm font-bold">Situação atual</h3><p className="mt-2 text-xs text-muted-foreground">Biometria: {cadastro.biometrias[0]?.status ?? "não enviada"}</p>{cadastro.habilitacao && <p className="mt-1 text-xs text-muted-foreground">CNH {cadastro.habilitacao.categoria} · {cadastro.habilitacao.status}</p>}<p className="mt-1 text-xs text-muted-foreground">Última decisão: {cadastro.decisoes[0] ? `${cadastro.decisoes[0].acao} · ${cadastro.decisoes[0].etapa}` : "nenhuma"}</p></div>
                </div>
                <div className="mt-4 border-t border-border pt-4"><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Decidir por etapa</p><div className="flex flex-wrap gap-2">{ETAPAS.map((etapa) => <div key={etapa.id} className="flex items-center gap-1 rounded-md border border-border p-1"><span className="px-2 text-xs font-semibold">{etapa.nome}</span><Button size="sm" onClick={() => iniciar(cadastro.userId, perfil, etapa.id, "aprovar", cadastro.nome)}>Aprovar</Button><Button size="sm" variant="outline" onClick={() => iniciar(cadastro.userId, perfil, etapa.id, "correcao", cadastro.nome)}>Corrigir</Button><Button size="sm" variant="destructive" onClick={() => iniciar(cadastro.userId, perfil, etapa.id, etapa.id === "total" ? "excluir" : "rejeitar", cadastro.nome)}>{etapa.id === "total" ? "Reiniciar tudo" : "Rejeitar"}</Button></div>)}</div></div>
              </div>}
            </article>;
          })}
          {cadastros.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>}
        </div>
      )}
      <AlertDialog open={!!pendente} onOpenChange={(open) => { if (!open) setPendente(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar decisão</AlertDialogTitle><AlertDialogDescription>{pendente ? `${pendente.acao === "excluir" ? "Reiniciar todo" : pendente.acao} o credenciamento de ${pendente.nome}, etapa ${pendente.etapa}. A conta será mantida.` : ""}</AlertDialogDescription></AlertDialogHeader><textarea value={motivo} onChange={(e) => setMotivo(e.target.value.slice(0, 500))} rows={4} placeholder="Justificativa obrigatória (mínimo 10 caracteres)" className="w-full rounded-md border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={motivo.trim().length < 10 || decidir.isPending} onClick={(event) => { event.preventDefault(); if (pendente) decidir.mutate(pendente); }}>{decidir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </section>
  );
}
