import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, FileUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { MAX_DOCUMENTO_BYTES, ROTULO_STATUS_DOCUMENTO, TIPOS_DOCUMENTO, type PerfilDocumento, type StatusDocumento, type TipoDocumento } from "@/lib/credenciamento-documentos";
import { abrirDocumentoCredenciamento, enviarDocumentoCredenciamento } from "@/utils/credenciamento-documentos.functions";

interface Documento {
  id: string;
  tipo: TipoDocumento;
  nome_arquivo: string;
  status: StatusDocumento;
  motivo: string | null;
  created_at: string;
}

const corStatus: Record<StatusDocumento, string> = {
  em_analise: "bg-accent/20 text-accent-foreground",
  aprovado: "bg-success/15 text-success",
  correcao: "bg-destructive/10 text-destructive",
  rejeitado: "bg-destructive/10 text-destructive",
  excluido: "bg-secondary text-muted-foreground",
};

function lerArquivo(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Arquivo inválido."));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function DocumentosCredenciamento({ perfil }: { perfil: PerfilDocumento }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [enviandoTipo, setEnviandoTipo] = useState<TipoDocumento | null>(null);
  const tipos = TIPOS_DOCUMENTO[perfil];

  const documentos = useQuery({
    queryKey: ["documentos-credenciamento", user?.id, perfil],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credenciamento_documentos")
        .select("id, tipo, nome_arquivo, status, motivo, created_at")
        .eq("perfil", perfil)
        .neq("status", "excluido")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });

  const atuais = useMemo(() => {
    const mapa = new Map<TipoDocumento, Documento>();
    for (const documento of documentos.data ?? []) if (!mapa.has(documento.tipo)) mapa.set(documento.tipo, documento);
    return mapa;
  }, [documentos.data]);

  const enviar = useMutation({
    mutationFn: async ({ tipo, file }: { tipo: TipoDocumento; file: File }) => {
      if (!(["image/jpeg", "image/png", "application/pdf"] as string[]).includes(file.type)) throw new Error("Envie uma imagem JPG, PNG ou um PDF.");
      if (file.size > MAX_DOCUMENTO_BYTES) throw new Error("O arquivo deve ter no máximo 8 MB.");
      setEnviandoTipo(tipo);
      const conteudo = await lerArquivo(file);
      const resposta = await enviarDocumentoCredenciamento({ data: { perfil, tipo, nome: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "application/pdf", conteudo } });
      if ("error" in resposta) throw new Error(resposta.error as string);
      return resposta;
    },
    onSuccess: () => {
      toast.success("Documento enviado para análise.");
      void qc.invalidateQueries({ queryKey: ["documentos-credenciamento"] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setEnviandoTipo(null),
  });

  const abrir = async (id: string) => {
    const resposta = await abrirDocumentoCredenciamento({ data: { id } });
    if ("error" in resposta) return toast.error(resposta.error as string);
    window.open(resposta.url, "_blank", "noopener,noreferrer");
  };

  const enviados = tipos.filter((tipo) => atuais.has(tipo.id)).length;
  return (
    <section className="mt-6 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><FileCheck2 className="size-5" /> Análise manual por documentos</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Use esta opção se a biometria não for aprovada. Envie fotos nítidas ou PDF; somente você e o administrador master podem acessar.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{enviados}/{tipos.length} enviados</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {tipos.map((tipo) => {
          const atual = atuais.get(tipo.id);
          const enviando = enviandoTipo === tipo.id;
          return (
            <div key={tipo.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary"><FileUp className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{tipo.rotulo}</p>
                  {atual ? <button type="button" onClick={() => void abrir(atual.id)} className="mt-1 max-w-full truncate text-xs text-primary underline">{atual.nome_arquivo}</button> : <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou PDF · até 8 MB</p>}
                </div>
                {atual && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${corStatus[atual.status]}`}>{ROTULO_STATUS_DOCUMENTO[atual.status]}</span>}
              </div>
              {atual?.motivo && <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{atual.motivo}</p>}
              <label className="mt-3 block">
                <input type="file" accept="image/jpeg,image/png,application/pdf" capture={tipo.id === "selfie_documento" ? "user" : "environment"} className="sr-only" disabled={enviar.isPending} onChange={(event) => { const file = event.target.files?.[0]; if (file) enviar.mutate({ tipo: tipo.id, file }); event.target.value = ""; }} />
                <span className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent">
                  {enviando ? <Loader2 className="size-4 animate-spin" /> : atual ? <RefreshCw className="size-4" /> : <FileUp className="size-4" />}
                  {atual ? "Substituir" : "Escolher arquivo"}
                </span>
              </label>
            </div>
          );
        })}
      </div>
      {enviados === tipos.length && <p className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"><ShieldCheck className="size-4" /> Documentação completa e disponível para análise.</p>}
    </section>
  );
}
