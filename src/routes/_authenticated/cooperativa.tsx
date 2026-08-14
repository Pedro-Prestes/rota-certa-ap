import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Banknote,
  Building2,
  Landmark,
  Loader2,
  PercentCircle,
  Save,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { GuardaPerfil } from "@/components/GuardaPerfil";
import { BANCOS, ROTULO_CHAVE_PIX, ROTULO_TIPO_CONTA } from "@/lib/carteira-motorista";
import {
  ROTULO_STATUS_COOPERATIVA,
  ROTULO_STATUS_REPASSE_COOPERATIVA,
  ROTULO_TRANSACAO_COOPERATIVA,
  validarCooperativa,
  type EntradaCooperativa,
} from "@/lib/cooperativa";
import { UFS } from "@/lib/ufs";
import { moeda } from "@/lib/urbano";
import { TrilhaCredenciamentoPJ } from "@/components/TrilhaCredenciamentoPJ";
import { conformidadeCondutoresCooperativa } from "@/utils/credenciamento-pj.functions";
import {
  painelCooperativa,
  repassarCooperativa,
  salvarCooperativa,
  vincularMotoristaCooperativa,
} from "@/utils/cooperativa.functions";

export const Route = createFileRoute("/_authenticated/cooperativa")({
  head: () => ({
    meta: [
      { title: "Painel da cooperativa | Rateio e repasses RotaCerta" },
      {
        name: "description",
        content:
          "Cooperativas de táxi cadastram a conta de recebimento e acompanham o rateio automático de 3% por corrida, o saldo e os repasses feitos pela RotaCerta.",
      },
      { property: "og:title", content: "Painel da cooperativa | RotaCerta" },
      {
        property: "og:description",
        content:
          "Rateio automático da taxa administrativa por corrida, extrato por motorista e repasses via Pix ou conta bancária.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CooperativaProtegida,
});

const cartao = "rounded-2xl border border-border bg-card p-5 shadow-sm";
const campo =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const rotulo = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const botao =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";

const VAZIO: EntradaCooperativa = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  responsavel_nome: "",
  email_contato: "",
  telefone: "",
  municipio: "",
  uf: "",
  titular_nome: "",
  titular_documento: "",
  banco_codigo: "",
  tipo_conta: "",
  agencia: "",
  conta: "",
  pix_tipo: "",
  pix_chave: "",
};

const dataHora = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function CooperativaProtegida() {
  return (
    <GuardaPerfil perfis={["cooperativa", "motorista", "frotista"]}>
      <Cooperativa />
    </GuardaPerfil>
  );
}

function Cooperativa() {
  const qc = useQueryClient();
  const buscar = useServerFn(painelCooperativa);
  const salvar = useServerFn(salvarCooperativa);
  const repassar = useServerFn(repassarCooperativa);
  const vincular = useServerFn(vincularMotoristaCooperativa);

  const [form, setForm] = useState<EntradaCooperativa>(VAZIO);

  const painel = useQuery({ queryKey: ["cooperativa"], queryFn: () => buscar() });
  const coop = painel.data?.cooperativa ?? null;

  useEffect(() => {
    if (!coop) return;
    setForm({
      cnpj: coop.cnpj ?? "",
      razao_social: coop.razao_social ?? "",
      nome_fantasia: coop.nome_fantasia ?? "",
      responsavel_nome: coop.responsavel_nome ?? "",
      email_contato: coop.email_contato ?? "",
      telefone: coop.telefone ?? "",
      municipio: coop.municipio ?? "",
      uf: coop.uf ?? "",
      titular_nome: coop.titular_nome ?? "",
      titular_documento: coop.titular_documento ?? "",
      banco_codigo: coop.banco_codigo ?? "",
      tipo_conta: (coop.tipo_conta ?? "") as NonNullable<EntradaCooperativa["tipo_conta"]>,
      agencia: coop.agencia ?? "",
      conta: coop.conta ?? "",
      pix_tipo: (coop.pix_tipo ?? "") as NonNullable<EntradaCooperativa["pix_tipo"]>,
      pix_chave: coop.pix_chave ?? "",
    });
  }, [coop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const problemas = useMemo(() => validarCooperativa(form), [form]);

  const mSalvar = useMutation({
    mutationFn: () => salvar({ data: { dados: form } }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Cadastro da cooperativa salvo.");
      qc.invalidateQueries({ queryKey: ["cooperativa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRepassar = useMutation({
    mutationFn: () => repassar({ data: { cooperativaId: coop!.id } }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Repasse solicitado.");
      qc.invalidateQueries({ queryKey: ["cooperativa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mVincular = useMutation({
    mutationFn: (v: { motoristaId: string; ativo: boolean }) =>
      vincular({ data: { cooperativaId: coop!.id, ...v } }),
    onSuccess: (r) => {
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Vínculo atualizado.");
      qc.invalidateQueries({ queryKey: ["cooperativa"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof EntradaCooperativa) => (valor: string) =>
    setForm((f) => ({ ...f, [k]: valor }));

  const texto = (k: keyof EntradaCooperativa, label: string, placeholder = "") => (
    <label className="block">
      <span className={rotulo}>{label}</span>
      <input
        className={campo}
        value={String(form[k] ?? "")}
        onChange={(e) => set(k)(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <BotaoVoltar />
        <header className="mt-4">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
            <Building2 className="size-6 text-primary" /> Painel da cooperativa
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A taxa administrativa das corridas dos motoristas vinculados é particionada no mesmo
            instante do pagamento: {painel.data?.percentualPlataforma ?? 7}% para a plataforma e{" "}
            {painel.data?.percentualCooperativa ?? 3}% para a cooperativa, com repasse automático
            para a conta cadastrada.
          </p>
        </header>

        {painel.isLoading ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando painel…
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {coop && (
              <section className="grid gap-4 sm:grid-cols-3">
                <div className={cartao}>
                  <p className={rotulo}>Saldo disponível</p>
                  <p className="mt-1 text-2xl font-bold">
                    {moeda(painel.data?.carteira?.saldo_disponivel ?? 0)}
                  </p>
                  <button
                    type="button"
                    onClick={() => mRepassar.mutate()}
                    disabled={mRepassar.isPending}
                    className={`${botao} mt-3 w-full bg-primary text-primary-foreground`}
                  >
                    {mRepassar.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Solicitar repasse
                  </button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mínimo de {moeda(painel.data?.repasseMinimo ?? 10)} por repasse.
                  </p>
                </div>
                <div className={cartao}>
                  <p className={rotulo}>Já repassado</p>
                  <p className="mt-1 text-2xl font-bold">
                    {moeda(painel.data?.carteira?.saldo_repassado ?? 0)}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <PercentCircle className="size-4" />
                    {painel.data?.percentualCooperativa ?? 3}% da base de cada corrida
                  </p>
                </div>
                <div className={cartao}>
                  <p className={rotulo}>Situação do cadastro</p>
                  <p className="mt-1 text-lg font-bold">
                    {ROTULO_STATUS_COOPERATIVA[
                      coop.status as keyof typeof ROTULO_STATUS_COOPERATIVA
                    ] ?? coop.status}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="size-4" /> {painel.data?.motoristas?.length ?? 0} motorista(s)
                    vinculado(s)
                  </p>
                </div>
              </section>
            )}

            {coop && (
              <TrilhaCredenciamentoPJ
                tipo="cooperativa"
                extras={<SemaforoCondutores cooperativaId={coop.id} />}
              />
            )}


            <section className={cartao}>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Landmark className="size-5 text-primary" />
                {coop ? "Cadastro e conta de recebimento" : "Cadastrar cooperativa"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A conta de recebimento deve estar no CNPJ da cooperativa. Informe a chave Pix e/ou a
                conta bancária para liquidar automaticamente.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {texto("cnpj", "CNPJ", "00.000.000/0000-00")}
                {texto("razao_social", "Razão social")}
                {texto("nome_fantasia", "Nome fantasia")}
                {texto("responsavel_nome", "Responsável")}
                {texto("email_contato", "E-mail de contato")}
                {texto("telefone", "Telefone")}
                {texto("municipio", "Município")}
                <label className="block">
                  <span className={rotulo}>Estado</span>
                  <select
                    className={campo}
                    value={form.uf ?? ""}
                    onChange={(e) => set("uf")(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {UFS.map((u) => (
                      <option key={u.sigla} value={u.sigla}>
                        {u.sigla} — {u.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <h3 className="mt-6 text-sm font-bold">Conta de recebimento</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {texto("titular_nome", "Titular da conta")}
                {texto("titular_documento", "CNPJ do titular")}
                <label className="block">
                  <span className={rotulo}>Banco</span>
                  <select
                    className={campo}
                    value={form.banco_codigo ?? ""}
                    onChange={(e) => set("banco_codigo")(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {BANCOS.map((b) => (
                      <option key={b.codigo} value={b.codigo}>
                        {b.codigo} — {b.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={rotulo}>Tipo de conta</span>
                  <select
                    className={campo}
                    value={form.tipo_conta ?? ""}
                    onChange={(e) => set("tipo_conta")(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {Object.entries(ROTULO_TIPO_CONTA).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {texto("agencia", "Agência")}
                {texto("conta", "Conta (com dígito)")}
                <label className="block">
                  <span className={rotulo}>Tipo de chave Pix</span>
                  <select
                    className={campo}
                    value={form.pix_tipo ?? ""}
                    onChange={(e) => set("pix_tipo")(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {Object.entries(ROTULO_CHAVE_PIX).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {texto("pix_chave", "Chave Pix")}
              </div>

              {problemas.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-destructive">
                  {problemas.map((p) => (
                    <li key={p.campo}>• {p.mensagem}</li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => mSalvar.mutate()}
                disabled={mSalvar.isPending || problemas.length > 0}
                className={`${botao} mt-5 bg-primary text-primary-foreground`}
              >
                {mSalvar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Salvar cadastro
              </button>
            </section>

            {coop && (
              <>
                <section className={cartao}>
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                    <Users className="size-5 text-primary" /> Motoristas vinculados
                  </h2>
                  {(painel.data?.motoristas ?? []).length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Nenhum motorista vinculado. Informe o identificador do motorista para vincular.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-border text-sm">
                      {(painel.data?.motoristas ?? []).map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                          <span>
                            <strong>{m.nome}</strong>
                            <span className="ml-2 text-xs text-muted-foreground">
                              desde {dataHora(m.created_at)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              mVincular.mutate({
                                motoristaId: m.motorista_id,
                                ativo: m.status !== "ativo",
                              })
                            }
                            className={`${botao} border border-border`}
                          >
                            {m.status === "ativo" ? "Desativar" : "Reativar"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={cartao}>
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                    <Banknote className="size-5 text-primary" /> Extrato do rateio
                  </h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[38rem] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-muted-foreground">
                          <th className="py-2">Data</th>
                          <th className="py-2">Tipo</th>
                          <th className="py-2">Descrição</th>
                          <th className="py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(painel.data?.transacoes ?? []).map((t) => (
                          <tr key={t.id}>
                            <td className="py-2 whitespace-nowrap">{dataHora(t.created_at)}</td>
                            <td className="py-2">{ROTULO_TRANSACAO_COOPERATIVA[t.tipo] ?? t.tipo}</td>
                            <td className="py-2 text-muted-foreground">{t.descricao}</td>
                            <td className="py-2 text-right font-semibold">
                              {moeda(Number(t.valor))}
                            </td>
                          </tr>
                        ))}
                        {(painel.data?.transacoes ?? []).length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-muted-foreground">
                              Nenhum rateio registrado ainda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={cartao}>
                  <h2 className="font-display text-lg font-bold">Repasses</h2>
                  <ul className="mt-4 divide-y divide-border text-sm">
                    {(painel.data?.repasses ?? []).map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <span>
                          {dataHora(r.created_at)} •{" "}
                          <span className="text-muted-foreground">
                            {ROTULO_STATUS_REPASSE_COOPERATIVA[
                              r.status as keyof typeof ROTULO_STATUS_REPASSE_COOPERATIVA
                            ] ?? r.status}
                          </span>
                        </span>
                        <strong>{moeda(Number(r.valor))}</strong>
                      </li>
                    ))}
                    {(painel.data?.repasses ?? []).length === 0 && (
                      <li className="py-3 text-muted-foreground">Nenhum repasse enviado ainda.</li>
                    )}
                  </ul>
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
