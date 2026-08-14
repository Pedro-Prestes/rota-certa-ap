import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Car, Loader2, Plus, ScanSearch, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopNav } from "@/components/TopNav";
import { useAuth } from "@/hooks/use-auth";
import {
  IDADE_MAXIMA_VEICULO,
  ROTULO_ALVO,
  ROTULO_STATUS,
  avaliarVeiculo,
  formatarPlaca,
  type AlvoVerificacao,
  type StatusVerificacao,
} from "@/lib/idoneidade";
import { consultarIdoneidade } from "@/utils/idoneidade.functions";
import {
  TrilhaCadastroMotorista,
  useCredenciamentoMotorista,
  type Habilitacao,
} from "@/components/TrilhaCadastroMotorista";
import { pendenciasCompatibilidade } from "@/lib/habilitacao";

export const Route = createFileRoute("/_authenticated/verificacao")({
  head: () => ({
    meta: [
      { title: "Idoneidade e veículos — RotaCerta" },
      {
        name: "description",
        content:
          "Verificação de idoneidade de passageiros e motoristas e regularidade documental dos veículos cadastrados no RotaCerta: CPF, CNH, placa Mercosul, Renavam e CRLV.",
      },
      { property: "og:title", content: "Idoneidade e veículos — RotaCerta" },
      {
        property: "og:description",
        content:
          "Cadastro legalizado de veículos e consulta de idoneidade de passageiros e motoristas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Verificacao,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface Veiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  categoria: string;
  assentos: number;
  volume_bagageiro_l: number;
  carga_util_kg: number;
  renavam: string | null;
  chassi: string | null;
  crlv_exercicio: number | null;
  crlv_situacao: string | null;
  status_verificacao: StatusVerificacao;
}

interface Verificacao {
  id: string;
  alvo: AlvoVerificacao;
  documento: string;
  nome_conferido: string | null;
  provedor: string;
  status: StatusVerificacao;
  pontuacao: number | null;
  pendencias: string[];
  veiculo_id: string | null;
  consultado_em: string | null;
  created_at: string;
}

const corStatus: Record<StatusVerificacao, string> = {
  aprovado: "bg-success/15 text-success",
  em_analise: "bg-accent/20 text-accent-foreground",
  pendente: "bg-secondary text-muted-foreground",
  reprovado: "bg-destructive/10 text-destructive",
  expirado: "bg-secondary text-muted-foreground",
};

function Verificacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novoVeiculo, setNovoVeiculo] = useState(false);
  const cred = useCredenciamentoMotorista();
  const [alvo, setAlvo] = useState<AlvoVerificacao>("motorista");
  const [form, setForm] = useState({ documento: "", nome: "", cnh: "", dataNascimento: "", veiculoId: "" });

  const veiculos = useQuery({
    queryKey: ["veiculos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Veiculo[];
    },
  });

  const verificacoes = useQuery({
    queryKey: ["verificacoes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verificacoes_idoneidade")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Verificacao[];
    },
  });

  const consultar = useMutation({
    mutationFn: async () => {
      const r = await consultarIdoneidade({
        data: {
          alvo,
          documento: form.documento,
          ...(form.nome ? { nome: form.nome } : {}),
          ...(form.cnh ? { cnh: form.cnh } : {}),
          ...(form.dataNascimento ? { dataNascimento: form.dataNascimento } : {}),
          ...(alvo === "veiculo" && form.veiculoId ? { veiculoId: form.veiculoId } : {}),
        },
      });
      if ("error" in r) throw new Error(r.error as string);
      return r;
    },
    onSuccess: (r) => {
      if (r.status === "aprovado") toast.success("Verificação aprovada.");
      else if (r.status === "reprovado") toast.error("Verificação reprovada — veja as pendências.");
      else toast.warning("Verificação em análise — há pendências a resolver.");
      qc.invalidateQueries({ queryKey: ["verificacoes"] });
      qc.invalidateQueries({ queryKey: ["veiculos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nomeVeiculo = (id: string | null) => {
    const v = (veiculos.data ?? []).find((x) => x.id === id);
    return v ? `${v.marca} ${v.modelo} · ${v.placa}` : "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BadgeCheck className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Idoneidade e veículos</h1>
            <p className="text-sm text-muted-foreground">
              Conferência de CPF, CNH, placa, Renavam, chassi e CRLV nos mesmos critérios usados
              pelas plataformas de mobilidade.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <TrilhaCadastroMotorista />
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <ScanSearch className="size-4" /> Nova consulta
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["passageiro", "motorista", "veiculo"] as AlvoVerificacao[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAlvo(a)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    alvo === a
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {ROTULO_ALVO[a]}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4">
              {alvo === "veiculo" ? (
                <div>
                  <label className={rotulo}>Veículo cadastrado</label>
                  <select
                    className={campo}
                    value={form.veiculoId}
                    onChange={(e) => setForm({ ...form, veiculoId: e.target.value })}
                  >
                    <option value="">Selecione…</option>
                    {(veiculos.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.marca} {v.modelo} — {v.placa}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={rotulo}>CPF</label>
                      <input
                        className={campo}
                        value={form.documento}
                        onChange={(e) => setForm({ ...form, documento: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className={rotulo}>Nome civil completo</label>
                      <input
                        className={campo}
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      />
                    </div>
                  </div>
                  {alvo === "motorista" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={rotulo}>Número da CNH</label>
                        <input
                          className={campo}
                          value={form.cnh}
                          onChange={(e) => setForm({ ...form, cnh: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={rotulo}>Data de nascimento</label>
                        <input
                          type="date"
                          className={campo}
                          value={form.dataNascimento}
                          onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <button
                onClick={() => consultar.mutate()}
                disabled={
                  consultar.isPending ||
                  (alvo === "veiculo" ? !form.veiculoId : form.documento.length < 11)
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {consultar.isPending && <Loader2 className="size-4 animate-spin" />} Consultar
                idoneidade
              </button>
              <p className="text-xs text-muted-foreground">
                As validações determinísticas (dígitos verificadores, idade do veículo, vigência do
                CRLV) rodam sempre. Ao configurar as credenciais do birô de consulta, o resultado
                externo é somado automaticamente a estas regras.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Car className="size-4" /> Veículos ({(veiculos.data ?? []).length})
              </h2>
              <button
                onClick={() => setNovoVeiculo(true)}
                disabled={!cred.veiculoLiberado}
                title={
                  cred.veiculoLiberado
                    ? "Cadastrar veículo"
                    : "Conclua as fases 1 e 2 do credenciamento"
                }
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus className="size-4" /> Cadastrar
              </button>
            </div>
            {!cred.veiculoLiberado && (
              <p className="mt-3 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
                Cadastro de veículo bloqueado: conclua a fase 1 (idoneidade + biometria facial) e a
                fase 2 (CNH válida, categoria compatível e EAR) na trilha acima.
              </p>
            )}
            <div className="mt-4 space-y-2">
              {(veiculos.data ?? []).map((v) => {
                const avaliacao = avaliarVeiculo({
                  placa: v.placa,
                  ano: v.ano,
                  renavam: v.renavam,
                  chassi: v.chassi,
                  assentos: v.assentos,
                  crlv_exercicio: v.crlv_exercicio,
                  crlv_situacao: v.crlv_situacao,
                });
                return (
                  <div key={v.id} className="rounded-xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {v.marca} {v.modelo}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
                        {v.placa}
                      </span>
                      <span className="text-muted-foreground">{v.ano}</span>
                      <span
                        className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${corStatus[v.status_verificacao]}`}
                      >
                        {ROTULO_STATUS[v.status_verificacao]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v.assentos} assentos · {v.volume_bagageiro_l} L de bagageiro ·{" "}
                      {v.carga_util_kg} kg de carga útil
                    </p>
                    {avaliacao.pendencias.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {avaliacao.pendencias.map((p) => (
                          <li key={p} className="flex items-start gap-1.5 text-xs text-destructive">
                            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {(veiculos.data ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum veículo cadastrado. Só são aceitos veículos com até{" "}
                  {IDADE_MAXIMA_VEICULO} anos de fabricação.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Histórico de verificações</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Data</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Alvo</th>
                  <th className="py-2">Provedor</th>
                  <th className="py-2">Pontuação</th>
                  <th className="py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {(verificacoes.data ?? []).map((v) => (
                  <tr key={v.id} className="border-t border-border/70 align-top">
                    <td className="py-3 text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 font-medium">{ROTULO_ALVO[v.alvo]}</td>
                    <td className="py-3 text-muted-foreground">
                      {v.alvo === "veiculo"
                        ? nomeVeiculo(v.veiculo_id)
                        : v.nome_conferido || v.documento}
                      {v.pendencias?.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {v.pendencias.map((p) => (
                            <li key={p} className="text-xs text-destructive">
                              • {p}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {v.provedor === "local" ? "Validação local" : "Birô externo"}
                    </td>
                    <td className="py-3 font-semibold">{v.pontuacao ?? "—"}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${corStatus[v.status]}`}
                      >
                        {ROTULO_STATUS[v.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {(verificacoes.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma verificação realizada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {novoVeiculo && user && (
        <FormularioVeiculo
          userId={user.id}
          habilitacao={cred.habilitacao}
          onFechar={() => setNovoVeiculo(false)}
          onSalvo={() => {
            setNovoVeiculo(false);
            qc.invalidateQueries({ queryKey: ["veiculos"] });
          }}
        />
      )}
    </div>
  );
}

function FormularioVeiculo({
  userId,
  habilitacao,
  onFechar,
  onSalvo,
}: {
  userId: string;
  habilitacao: Habilitacao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const anoAtual = new Date().getFullYear();
  const [f, setF] = useState({
    placa: "",
    marca: "",
    modelo: "",
    ano: anoAtual,
    cor: "",
    categoria: "passageiro",
    assentos: 5,
    volume_bagageiro_l: 400,
    carga_util_kg: 450,
    renavam: "",
    chassi: "",
    crlv_exercicio: anoAtual,
    crlv_situacao: "regular",
  });

  const avaliacao = avaliarVeiculo({
    placa: f.placa,
    ano: Number(f.ano),
    renavam: f.renavam || null,
    chassi: f.chassi || null,
    assentos: Number(f.assentos),
    crlv_exercicio: Number(f.crlv_exercicio),
    crlv_situacao: f.crlv_situacao,
  });

  const compatibilidade = pendenciasCompatibilidade(
    habilitacao ? { categoria: habilitacao.categoria, ear: habilitacao.ear } : null,
    Number(f.assentos),
  );
  const pendencias = [...avaliacao.pendencias, ...compatibilidade];

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("veiculos").insert({
        user_id: userId,
        placa: formatarPlaca(f.placa),
        marca: f.marca,
        modelo: f.modelo,
        ano: Number(f.ano),
        cor: f.cor || null,
        categoria: f.categoria,
        assentos: Number(f.assentos),
        volume_bagageiro_l: Number(f.volume_bagageiro_l),
        carga_util_kg: Number(f.carga_util_kg),
        renavam: f.renavam || null,
        chassi: f.chassi || null,
        crlv_exercicio: Number(f.crlv_exercicio),
        crlv_situacao: f.crlv_situacao || null,
        status_verificacao: "pendente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Veículo cadastrado. Rode a consulta de idoneidade para liberá-lo.");
      onSalvo();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold">Cadastrar veículo</h2>
          <button onClick={onFechar} className="ml-auto rounded-full border border-border p-2">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={rotulo}>Placa</label>
            <input
              className={`${campo} font-mono uppercase`}
              value={f.placa}
              onChange={(e) => setF({ ...f, placa: formatarPlaca(e.target.value) })}
              placeholder="ABC1D23"
            />
          </div>
          <div>
            <label className={rotulo}>Marca</label>
            <input className={campo} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
          </div>
          <div>
            <label className={rotulo}>Modelo</label>
            <input
              className={campo}
              value={f.modelo}
              onChange={(e) => setF({ ...f, modelo: e.target.value })}
            />
          </div>
          <div>
            <label className={rotulo}>Ano de fabricação</label>
            <input
              type="number"
              className={campo}
              value={f.ano}
              onChange={(e) => setF({ ...f, ano: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={rotulo}>Cor</label>
            <input className={campo} value={f.cor} onChange={(e) => setF({ ...f, cor: e.target.value })} />
          </div>
          <div>
            <label className={rotulo}>Categoria</label>
            <select
              className={campo}
              value={f.categoria}
              onChange={(e) => setF({ ...f, categoria: e.target.value })}
            >
              <option value="passageiro">Veículo de passageiros</option>
              <option value="utilitario_pequeno">Utilitário pequeno</option>
              <option value="utilitario_medio">Utilitário médio</option>
              <option value="utilitario_grande">Utilitário grande</option>
            </select>
          </div>
          <div>
            <label className={rotulo}>Assentos</label>
            <input
              type="number"
              className={campo}
              value={f.assentos}
              onChange={(e) => setF({ ...f, assentos: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={rotulo}>Bagageiro (L)</label>
            <input
              type="number"
              className={campo}
              value={f.volume_bagageiro_l}
              onChange={(e) => setF({ ...f, volume_bagageiro_l: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={rotulo}>Carga útil (kg)</label>
            <input
              type="number"
              className={campo}
              value={f.carga_util_kg}
              onChange={(e) => setF({ ...f, carga_util_kg: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={rotulo}>Renavam</label>
            <input
              className={campo}
              value={f.renavam}
              onChange={(e) => setF({ ...f, renavam: e.target.value })}
            />
          </div>
          <div>
            <label className={rotulo}>Chassi</label>
            <input
              className={`${campo} uppercase`}
              value={f.chassi}
              onChange={(e) => setF({ ...f, chassi: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className={rotulo}>Exercício do CRLV</label>
            <input
              type="number"
              className={campo}
              value={f.crlv_exercicio}
              onChange={(e) => setF({ ...f, crlv_exercicio: Number(e.target.value) })}
            />
          </div>
        </div>

        {pendencias.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-destructive/10 p-4">
            {pendencias.map((p) => (
              <li key={p} className="text-xs text-destructive">
                • {p}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => salvar.mutate()}
          disabled={
            salvar.isPending ||
            !f.placa ||
            !f.marca ||
            !f.modelo ||
            compatibilidade.length > 0
          }
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Cadastrar veículo
        </button>
      </div>
    </div>
  );
}
