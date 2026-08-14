import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  Check,
  FileCheck2,
  Loader2,
  Lock,
  ScanFace,
  ShieldAlert,
  Truck,
} from "lucide-react";
import {
  ALERTA_VENCIMENTO_DIAS,
  DOCUMENTOS_PJ,
  ROTULO_STATUS_DOC,
  aguardandoMaster,
  documentoValido,
  type DocumentoPJ,
  type TipoEntidadePJ,
} from "@/lib/credenciamento-pj";
import {
  enviarDocumentoPJ,
  painelCredenciamentoPJ,
} from "@/utils/credenciamento-pj.functions";

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

/** Situação do credenciamento em 3 fases da empresa logada. */
export function useCredenciamentoPJ(tipo: TipoEntidadePJ) {
  const buscar = useServerFn(painelCredenciamentoPJ);
  const painel = useQuery({
    queryKey: ["credenciamento-pj", tipo],
    queryFn: () => buscar({ data: { tipo } }),
  });

  const situacao = painel.data?.situacao ?? null;
  return {
    carregando: painel.isLoading,
    entidade: painel.data?.entidade ?? null,
    documentos: (painel.data?.documentos ?? []) as DocumentoPJ[],
    biometriaOk: !!painel.data?.biometriaOk,
    situacao,
    fase1Ok: !!situacao?.fase1Ok,
    fase2Ok: !!situacao?.fase2Ok,
    /** Fase 3: cadastro de veículo e vínculo de condutores liberados. */
    fase3Liberada: !!situacao?.fase3Liberada,
    score: situacao?.score ?? 0,
  };
}

/** Situação exibida para cada exigência da empresa. */
function estadoDoDoc(doc: DocumentoPJ | undefined) {
  if (documentoValido(doc)) return "ok" as const;
  if (aguardandoMaster(doc)) return "analise" as const;
  return "pendente" as const;
}

function Selo({ estado }: { estado: "ok" | "analise" | "pendente" | "bloqueado" }) {
  if (estado === "analise")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
        <ShieldAlert className="size-3" /> Em análise do master
      </span>
    );
  if (estado === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
        <Check className="size-3" /> Aprovado
      </span>
    );
  if (estado === "bloqueado")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        <Lock className="size-3" /> Bloqueado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
      <ShieldAlert className="size-3" /> Pendente
    </span>
  );
}

function Medidor({ score }: { score: number }) {
  return (
    <div className="min-w-40">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">Conformidade</span>
        <span>{score}/100</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-secondary">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Trilha visual das 3 fases obrigatórias da pessoa jurídica, com envio dos
 * documentos de conformidade e avaliação automática.
 */
export function TrilhaCredenciamentoPJ({
  tipo,
  extras,
}: {
  tipo: TipoEntidadePJ;
  extras?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const cred = useCredenciamentoPJ(tipo);
  const enviar = useServerFn(enviarDocumentoPJ);
  const defs = DOCUMENTOS_PJ[tipo];

  const [aberto, setAberto] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [orgao, setOrgao] = useState("");
  const [validade, setValidade] = useState("");

  const porTipo = useMemo(
    () => new Map(cred.documentos.map((d) => [d.tipo_documento, d])),
    [cred.documentos],
  );

  const envio = useMutation({
    mutationFn: async (tipo_documento: string) => {
      const r = await enviar({
        data: { tipo, entrada: { tipo_documento, numero, orgao_emissor: orgao, validade } },
      });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      const pendencias = "avaliacao" in r ? r.avaliacao.pendencias : [];
      if (pendencias.length) toast.error(pendencias[0]);
      else toast.success("Documento enviado para autorização do administrador master.");
      setAberto(null);
      setNumero("");
      setOrgao("");
      setValidade("");
      qc.invalidateQueries({ queryKey: ["credenciamento-pj", tipo] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (cred.carregando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Carregando credenciamento da empresa…
      </div>
    );
  }

  const rotuloPerfil = tipo === "cooperativa" ? "cooperativa" : "empresa";

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Credenciamento em 3 fases</h2>
        {cred.situacao?.verificada && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
            <BadgeCheck className="size-3.5" />{" "}
            {tipo === "cooperativa" ? "Cooperativa verificada" : "Frota verificada"}
          </span>
        )}
        <div className="ml-auto">
          <Medidor score={cred.score} />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        A operação da {rotuloPerfil} é liberada por etapas: primeiro a empresa e o responsável
        legal, depois a conformidade documental e só então a frota e os condutores. A aprovação e a
        reprovação de cada documento são feitas exclusivamente pelo administrador master.
      </p>

      {/* Fase 1 */}
      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="size-4 text-primary" />
          <strong className="text-sm">Fase 1 · Empresa e responsável legal</strong>
          <span className="ml-auto">
            <Selo estado={cred.fase1Ok ? "ok" : "pendente"} />
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">CNPJ ativo</span>
            <Selo estado={estadoDoDoc(porTipo.get("cnpj"))} />
            <button
              onClick={() => setAberto(aberto === "cnpj" ? null : "cnpj")}
              className="text-xs font-semibold text-primary underline"
            >
              Enviar / atualizar
            </button>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <ScanFace className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Biometria facial do responsável legal
            </span>
            <Selo estado={cred.biometriaOk ? "ok" : "pendente"} />
            {!cred.biometriaOk && (
              <Link to="/biometria" className="text-xs font-semibold text-primary underline">
                Fazer agora
              </Link>
            )}
          </li>
        </ul>
        {aberto === "cnpj" && (
          <FormularioDoc
            def={defs[0]!}
            numero={numero}
            orgao={orgao}
            validade={validade}
            setNumero={setNumero}
            setOrgao={setOrgao}
            setValidade={setValidade}
            enviando={envio.isPending}
            onEnviar={() => envio.mutate("cnpj")}
          />
        )}
      </div>

      {/* Fase 2 */}
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <strong className="text-sm">Fase 2 · Conformidade documental</strong>
          <span className="ml-auto">
            <Selo estado={cred.fase2Ok ? "ok" : cred.fase1Ok ? "pendente" : "bloqueado"} />
          </span>
        </div>
        {!cred.fase1Ok ? (
          <p className="mt-3 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            Conclua a fase 1 (CNPJ aprovado e biometria facial do responsável) para enviar os
            documentos de conformidade.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {defs
              .filter((d) => d.fase === 2)
              .map((d) => {
                const doc = porTipo.get(d.tipo);
                return (
                  <li key={d.tipo} className="rounded-xl bg-secondary/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{d.titulo}</strong>
                      <Selo estado={estadoDoDoc(doc)} />
                      <button
                        onClick={() => setAberto(aberto === d.tipo ? null : d.tipo)}
                        className="ml-auto text-xs font-semibold text-primary underline"
                      >
                        Enviar / atualizar
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.descricao}</p>
                    {doc && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Situação: {ROTULO_STATUS_DOC[doc.status]}
                        {doc.validade ? ` · validade ${doc.validade}` : ""}
                        {doc.pendencias?.length ? ` · ${doc.pendencias[0]}` : ""}
                      </p>
                    )}
                    {aberto === d.tipo && (
                      <FormularioDoc
                        def={d}
                        numero={numero}
                        orgao={orgao}
                        validade={validade}
                        setNumero={setNumero}
                        setOrgao={setOrgao}
                        setValidade={setValidade}
                        enviando={envio.isPending}
                        onEnviar={() => envio.mutate(d.tipo)}
                      />
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {/* Fase 3 */}
      <div className="mt-4 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Truck className="size-4 text-primary" />
          <strong className="text-sm">Fase 3 · Frota e condutores</strong>
          <span className="ml-auto">
            <Selo estado={cred.fase3Liberada ? "ok" : "bloqueado"} />
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {cred.fase3Liberada
            ? tipo === "cooperativa"
              ? "Liberado: vincule condutores com idoneidade, biometria e CNH aprovadas."
              : "Liberado: cadastre veículos com CRLV vigente e escale condutores compatíveis."
            : "Bloqueado até a conclusão das fases 1 e 2 — a regra também é aplicada no banco de dados."}
        </p>
        {extras}
      </div>

      {cred.situacao?.aVencer?.length ? (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
          Renovação necessária em até {ALERTA_VENCIMENTO_DIAS} dias:{" "}
          {cred.situacao.aVencer
            .map((x) => `${x.doc.tipo_documento} (${x.dias} dia(s))`)
            .join(", ")}
          . Documento vencido suspende a operação da empresa.
        </p>
      ) : null}
    </section>
  );
}

function FormularioDoc({
  def,
  numero,
  orgao,
  validade,
  setNumero,
  setOrgao,
  setValidade,
  enviando,
  onEnviar,
}: {
  def: { titulo: string; exigeNumero: boolean; exigeValidade: boolean };
  numero: string;
  orgao: string;
  validade: string;
  setNumero: (v: string) => void;
  setOrgao: (v: string) => void;
  setValidade: (v: string) => void;
  enviando: boolean;
  onEnviar: () => void;
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
      {def.exigeNumero && (
        <div>
          <label className={rotulo}>Número · {def.titulo}</label>
          <input className={campo} value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
      )}
      <div>
        <label className={rotulo}>Órgão emissor</label>
        <input className={campo} value={orgao} onChange={(e) => setOrgao(e.target.value)} />
      </div>
      {def.exigeValidade && (
        <div>
          <label className={rotulo}>Validade</label>
          <input
            type="date"
            className={campo}
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
          />
        </div>
      )}
      <div className="sm:col-span-3">
        <button
          onClick={onEnviar}
          disabled={enviando}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
          Enviar para análise
        </button>
      </div>
    </div>
  );
}
