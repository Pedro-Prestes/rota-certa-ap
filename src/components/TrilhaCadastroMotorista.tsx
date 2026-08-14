import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, IdCard, Loader2, Lock, ScanFace, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { enviarHabilitacao } from "@/utils/habilitacao.functions";
import { CATEGORIAS_CNH, FASES, avaliarHabilitacao } from "@/lib/habilitacao";
import type { StatusVerificacao } from "@/lib/idoneidade";

export interface Habilitacao {
  id: string;
  numero: string;
  categoria: string;
  ear: boolean;
  validade: string | null;
  primeira_habilitacao: string | null;
  status: StatusVerificacao;
  pendencias: string[];
}

/**
 * Situação do credenciamento do motorista nas três fases obrigatórias:
 * 1) idoneidade + biometria facial, 2) CNH válida com EAR, 3) veículo.
 */
export function useCredenciamentoMotorista() {
  const { user } = useAuth();

  const idoneidade = useQuery({
    queryKey: ["credenciamento-idoneidade", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verificacoes_idoneidade")
        .select("status, pendencias, created_at")
        .eq("alvo", "motorista")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as unknown as {
        status: StatusVerificacao;
        pendencias: string[];
      } | null;
    },
  });

  const biometria = useQuery({
    queryKey: ["credenciamento-biometria", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verificacoes_biometricas")
        .select("status, created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
  });

  const habilitacao = useQuery({
    queryKey: ["credenciamento-habilitacao", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habilitacoes_motorista")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Habilitacao | null) ?? null;
    },
  });

  const carregando = idoneidade.isLoading || biometria.isLoading || habilitacao.isLoading;
  const idoneidadeOk = idoneidade.data?.status === "aprovado";
  const biometriaOk = biometria.data?.status === "aprovada";
  const fase1Ok = idoneidadeOk && biometriaOk;
  const validadeOk =
    !habilitacao.data?.validade ||
    new Date(`${habilitacao.data.validade}T12:00:00`).getTime() >= Date.now();
  const fase2Ok = fase1Ok && habilitacao.data?.status === "aprovado" && validadeOk;

  return {
    carregando,
    idoneidade: idoneidade.data,
    biometria: biometria.data,
    habilitacao: habilitacao.data ?? null,
    idoneidadeOk,
    biometriaOk,
    fase1Ok,
    fase2Ok,
    /** Fase 3 (cadastro de veículo) liberada. */
    veiculoLiberado: fase2Ok,
  };
}

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

function Selo({ estado }: { estado: "ok" | "pendente" | "bloqueado" }) {
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

export function TrilhaCadastroMotorista() {
  const qc = useQueryClient();
  const cred = useCredenciamentoMotorista();
  const [f, setF] = useState({ numero: "", categoria: "B", ear: true, validade: "", primeira: "" });

  const previa = avaliarHabilitacao({
    numero: f.numero,
    categoria: f.categoria,
    ear: f.ear,
    validade: f.validade || null,
    primeiraHabilitacao: f.primeira || null,
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const r = await enviarHabilitacao({
        data: {
          numero: f.numero,
          categoria: f.categoria,
          ear: f.ear,
          ...(f.validade ? { validade: f.validade } : {}),
          ...(f.primeira ? { primeiraHabilitacao: f.primeira } : {}),
        },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      if (r.status === "aprovado") toast.success("CNH aprovada — fase 3 liberada.");
      else toast.error("CNH reprovada — veja as pendências.");
      void qc.invalidateQueries({ queryKey: ["credenciamento-habilitacao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estados: ("ok" | "pendente" | "bloqueado")[] = [
    cred.fase1Ok ? "ok" : "pendente",
    cred.fase2Ok ? "ok" : cred.fase1Ok ? "pendente" : "bloqueado",
    cred.veiculoLiberado ? "ok" : "bloqueado",
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <IdCard className="size-4" /> Credenciamento do motorista em 3 fases
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada fase só abre com a anterior aprovada — o veículo só pode ser cadastrado ao final.
      </p>

      {cred.carregando ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Conferindo o seu credenciamento…
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {FASES.map((fase, i) => (
            <li
              key={fase.numero}
              className={`rounded-xl border p-4 ${
                estados[i] === "ok" ? "border-success/40 bg-success/5" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {fase.numero}
                </span>
                <span className="font-semibold">{fase.titulo}</span>
                <span className="ml-auto">
                  <Selo estado={estados[i] as "ok" | "pendente" | "bloqueado"} />
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fase.descricao}</p>

              {fase.numero === 1 && !cred.fase1Ok && (
                <div className="mt-3 space-y-2 text-xs">
                  {!cred.idoneidadeOk && (
                    <p className="text-destructive">
                      • Rode a consulta de idoneidade do motorista abaixo com CPF, nome completo, CNH
                      e data de nascimento.
                    </p>
                  )}
                  {!cred.biometriaOk && (
                    <p className="flex flex-wrap items-center gap-2 text-destructive">
                      • Biometria facial ainda não aprovada.
                      <Link
                        to="/biometria"
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground"
                      >
                        <ScanFace className="size-3" /> Fazer agora
                      </Link>
                    </p>
                  )}
                  {(cred.idoneidade?.pendencias ?? []).map((p) => (
                    <p key={p} className="text-muted-foreground">
                      · {p}
                    </p>
                  ))}
                </div>
              )}

              {fase.numero === 2 && (
                <div className="mt-3">
                  {!cred.fase1Ok ? (
                    <p className="text-xs text-muted-foreground">
                      Conclua a fase 1 para liberar o envio da CNH.
                    </p>
                  ) : (
                    <>
                      {cred.habilitacao && (
                        <p className="text-xs text-muted-foreground">
                          CNH {cred.habilitacao.categoria}
                          {cred.habilitacao.ear ? " com EAR" : " sem EAR"}
                          {cred.habilitacao.validade
                            ? ` · validade ${new Date(
                                `${cred.habilitacao.validade}T12:00:00`,
                              ).toLocaleDateString("pt-BR")}`
                            : ""}
                        </p>
                      )}
                      {(cred.habilitacao?.pendencias ?? []).map((p) => (
                        <p key={p} className="mt-1 text-xs text-destructive">
                          • {p}
                        </p>
                      ))}

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={rotulo}>Número de registro da CNH</label>
                          <input
                            className={campo}
                            value={f.numero}
                            onChange={(e) => setF({ ...f, numero: e.target.value })}
                            placeholder="11 dígitos"
                          />
                        </div>
                        <div>
                          <label className={rotulo}>Categoria</label>
                          <select
                            className={campo}
                            value={f.categoria}
                            onChange={(e) => setF({ ...f, categoria: e.target.value })}
                          >
                            {CATEGORIAS_CNH.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={rotulo}>Validade</label>
                          <input
                            type="date"
                            className={campo}
                            value={f.validade}
                            onChange={(e) => setF({ ...f, validade: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={rotulo}>Primeira habilitação</label>
                          <input
                            type="date"
                            className={campo}
                            value={f.primeira}
                            onChange={(e) => setF({ ...f, primeira: e.target.value })}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={f.ear}
                            onChange={(e) => setF({ ...f, ear: e.target.checked })}
                          />
                          A CNH tem a observação <strong>EAR</strong> (Exerce Atividade Remunerada)
                        </label>
                      </div>

                      {f.numero && previa.pendencias.length > 0 && (
                        <ul className="mt-3 space-y-1 rounded-xl bg-destructive/10 p-3">
                          {previa.pendencias.map((p) => (
                            <li key={p} className="text-xs text-destructive">
                              • {p}
                            </li>
                          ))}
                        </ul>
                      )}

                      <button
                        onClick={() => enviar.mutate()}
                        disabled={enviar.isPending || !f.numero || !f.validade}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {enviar.isPending && <Loader2 className="size-4 animate-spin" />} Enviar CNH
                        para análise
                      </button>
                    </>
                  )}
                </div>
              )}

              {fase.numero === 3 && !cred.veiculoLiberado && (
                <p className="mt-3 text-xs text-muted-foreground">
                  O cadastro de veículo é liberado assim que as fases 1 e 2 forem aprovadas.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
