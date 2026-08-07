import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Banknote,
  CalendarClock,
  Landmark,
  Loader2,
  Plus,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { GuardaPerfil } from "@/components/GuardaPerfil";
import {
  BANCOS,
  REPASSE_SEMANAL_MINIMO,
  ROTULO_CHAVE_PIX,
  ROTULO_MOVIMENTO,
  ROTULO_STATUS_REPASSE,
  ROTULO_TIPO_CONTA,
  SAQUE_MINIMO,
  TAXA_SAQUE_INSTANTANEO,
  comporSaque,
  validarConta,
  type StatusRepasse,
  type TipoChavePix,
  type TipoConta,
  type TipoMovimento,
} from "@/lib/carteira-motorista";
import {
  consultarCarteiraMotorista,
  definirContaPrincipal,
  removerContaRepasse,
  salvarContaRepasse,
  solicitarSaqueMotorista,
} from "@/utils/carteira-motorista.functions";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira do motorista | Ganhos e repasses RotaCerta" },
      {
        name: "description",
        content:
          "Acompanhe seus ganhos por viagem, taxas descontadas e solicite saque instantâneo via Pix ou repasse semanal automático na RotaCerta.",
      },
      { property: "og:title", content: "Carteira do motorista | RotaCerta" },
      {
        property: "og:description",
        content:
          "Saldo disponível, extrato de ganhos e repasses bancários automáticos para motoristas da RotaCerta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CarteiraProtegida,
});

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (v: string) => new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const campo =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const rotulo = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

interface Conta {
  id: string;
  holder_name: string;
  holder_document: string;
  bank_code: string | null;
  bank_name: string | null;
  account_type: TipoConta | null;
  agency_number: string | null;
  account_number: string | null;
  pix_key_type: TipoChavePix | null;
  pix_key: string | null;
  is_primary: boolean;
  is_verified: boolean;
}

interface Movimento {
  id: string;
  type: TipoMovimento;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

interface Repasse {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payout_method: string;
  mode: string;
  status: StatusRepasse;
  created_at: string;
  processed_at: string | null;
  failure_reason: string | null;
}

const formVazio = {
  holder_name: "",
  holder_document: "",
  bank_code: "",
  account_type: "" as TipoConta | "",
  agency_number: "",
  account_number: "",
  pix_key_type: "" as TipoChavePix | "",
  pix_key: "",
  principal: true,
};

function CarteiraMotorista() {
  const qc = useQueryClient();
  const carregar = useServerFn(consultarCarteiraMotorista);
  const salvar = useServerFn(salvarContaRepasse);
  const principal = useServerFn(definirContaPrincipal);
  const remover = useServerFn(removerContaRepasse);
  const sacar = useServerFn(solicitarSaqueMotorista);

  const [form, setForm] = useState(formVazio);
  const [formAberto, setFormAberto] = useState(false);
  const [valorSaque, setValorSaque] = useState("");
  const [metodo, setMetodo] = useState<"PIX" | "TED">("PIX");
  const [contaSaque, setContaSaque] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["carteira-motorista"],
    queryFn: () => carregar(),
  });

  const atualizar = () => qc.invalidateQueries({ queryKey: ["carteira-motorista"] });

  const contas = (data?.contas ?? []) as unknown as Conta[];
  const movimentos = (data?.movimentos ?? []) as unknown as Movimento[];
  const repasses = (data?.repasses ?? []) as unknown as Repasse[];
  const disponivel = Number(data?.carteira.balance_available ?? 0);
  const pendente = Number(data?.carteira.balance_pending ?? 0);

  const ganhos = useMemo(
    () => movimentos.filter((m) => m.type === "RIDE_EARNING").reduce((t, m) => t + Number(m.amount), 0),
    [movimentos],
  );
  const taxas = useMemo(
    () => movimentos.filter((m) => m.type === "PLATFORM_FEE").reduce((t, m) => t + Number(m.amount), 0),
    [movimentos],
  );

  const composicaoSaque = comporSaque(Number(valorSaque.replace(",", ".")) || 0, "INSTANT");

  const mSalvar = useMutation({
    mutationFn: async () => {
      const problemas = validarConta(form);
      if (problemas.length) throw new Error(problemas[0]!.mensagem);
      const r = await salvar({
        data: {
          principal: form.principal,
          dados: {
            holder_name: form.holder_name,
            holder_document: form.holder_document,
            bank_code: form.bank_code,
            account_type: form.account_type,
            agency_number: form.agency_number,
            account_number: form.account_number,
            pix_key_type: form.pix_key_type,
            pix_key: form.pix_key,
          },
        },
      });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      toast.success("Conta de repasse cadastrada.");
      setForm(formVazio);
      setFormAberto(false);
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mPrincipal = useMutation({
    mutationFn: async (contaId: string) => {
      const r = await principal({ data: { contaId } });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      toast.success("Conta principal atualizada.");
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mRemover = useMutation({
    mutationFn: async (contaId: string) => {
      const r = await remover({ data: { contaId } });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      toast.success("Conta removida.");
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mSacar = useMutation({
    mutationFn: async () => {
      const r = await sacar({
        data: {
          valor: Number(valorSaque.replace(",", ".")) || 0,
          metodo,
          ...(contaSaque ? { contaId: contaSaque } : {}),
        },
      });
      if ("error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: () => {
      toast.success("Saque solicitado. A liquidação bancária foi iniciada.");
      setValorSaque("");
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Carteira do motorista</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ganhos por viagem concluída, taxas descontadas e repasses para a sua conta. Repasse
              automático toda segunda-feira às 06:00 para saldos acima de {brl(REPASSE_SEMANAL_MINIMO)}.
            </p>
          </div>
        </header>

        {isLoading ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando sua carteira…
          </p>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { rot: "Saldo disponível", valor: disponivel, icone: Wallet },
                { rot: "Em liquidação", valor: pendente, icone: CalendarClock },
                { rot: "Ganhos acumulados", valor: ganhos, icone: Banknote },
                { rot: "Taxas RotaCerta", valor: taxas, icone: Landmark },
              ].map((c) => (
                <div key={c.rot} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <c.icone className="size-4" /> {c.rot}
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold">{brl(c.valor)}</p>
                </div>
              ))}
            </section>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display text-lg font-bold">Saque instantâneo (Pix)</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mínimo de {brl(SAQUE_MINIMO)} com taxa fixa de {brl(TAXA_SAQUE_INSTANTANEO)} por saque
                  fora do ciclo semanal.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={rotulo}>Valor do saque</span>
                    <input
                      className={campo}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorSaque}
                      onChange={(e) => setValorSaque(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className={rotulo}>Método</span>
                    <select
                      className={campo}
                      value={metodo}
                      onChange={(e) => setMetodo(e.target.value as "PIX" | "TED")}
                    >
                      <option value="PIX">Pix (instantâneo)</option>
                      <option value="TED">TED bancária</option>
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={rotulo}>Conta de destino</span>
                    <select
                      className={campo}
                      value={contaSaque}
                      onChange={(e) => setContaSaque(e.target.value)}
                    >
                      <option value="">Conta principal</option>
                      {contas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.bank_name ?? "Chave Pix"} · {c.pix_key ?? `${c.agency_number}/${c.account_number}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <dl className="mt-4 space-y-1 rounded-xl bg-secondary/60 p-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Valor solicitado</dt>
                    <dd>{brl(composicaoSaque.valor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Taxa de saque instantâneo</dt>
                    <dd>− {brl(composicaoSaque.taxa)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Você recebe</dt>
                    <dd>{brl(composicaoSaque.liquido)}</dd>
                  </div>
                </dl>

                <button
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  disabled={
                    mSacar.isPending ||
                    composicaoSaque.valor < SAQUE_MINIMO ||
                    composicaoSaque.valor > disponivel ||
                    contas.length === 0
                  }
                  onClick={() => mSacar.mutate()}
                >
                  {mSacar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                  Solicitar saque
                </button>
                {contas.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cadastre uma conta de repasse para habilitar o saque.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">Contas de repasse</h2>
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setFormAberto((v) => !v)}
                  >
                    <Plus className="size-3.5" /> Nova conta
                  </button>
                </div>

                <ul className="mt-4 space-y-3">
                  {contas.map((c) => (
                    <li key={c.id} className="rounded-xl border border-border p-4 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {c.holder_name}
                            {c.is_primary && (
                              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                Principal
                              </span>
                            )}
                            {c.is_verified && (
                              <BadgeCheck className="ml-1 inline size-4 text-primary" aria-label="Verificada" />
                            )}
                          </p>
                          <p className="text-muted-foreground">
                            {c.bank_name ? `${c.bank_name} · ` : ""}
                            {c.account_type ? `${ROTULO_TIPO_CONTA[c.account_type]} · ` : ""}
                            {c.agency_number && c.account_number
                              ? `Ag. ${c.agency_number} / Cc. ${c.account_number}`
                              : ""}
                          </p>
                          {c.pix_key && (
                            <p className="text-muted-foreground">
                              Pix ({c.pix_key_type ? ROTULO_CHAVE_PIX[c.pix_key_type] : "chave"}): {c.pix_key}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {!c.is_primary && (
                            <button
                              className="rounded-full border border-border p-1.5"
                              title="Definir como principal"
                              onClick={() => mPrincipal.mutate(c.id)}
                            >
                              <Star className="size-3.5" />
                            </button>
                          )}
                          <button
                            className="rounded-full border border-border p-1.5 text-destructive"
                            title="Remover conta"
                            onClick={() => mRemover.mutate(c.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                  {contas.length === 0 && (
                    <li className="text-sm text-muted-foreground">Nenhuma conta cadastrada ainda.</li>
                  )}
                </ul>

                {formAberto && (
                  <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className={rotulo}>Nome do titular</span>
                      <input
                        className={campo}
                        value={form.holder_name}
                        onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className={rotulo}>CPF/CNPJ do titular</span>
                      <input
                        className={campo}
                        inputMode="numeric"
                        value={form.holder_document}
                        onChange={(e) => setForm({ ...form, holder_document: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Banco</span>
                      <select
                        className={campo}
                        value={form.bank_code}
                        onChange={(e) => setForm({ ...form, bank_code: e.target.value })}
                      >
                        <option value="">Somente Pix</option>
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
                        value={form.account_type}
                        onChange={(e) =>
                          setForm({ ...form, account_type: e.target.value as TipoConta | "" })
                        }
                      >
                        <option value="">Selecione</option>
                        <option value="CHECKING">Conta corrente</option>
                        <option value="SAVINGS">Conta poupança</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className={rotulo}>Agência (sem hífen)</span>
                      <input
                        className={campo}
                        inputMode="numeric"
                        value={form.agency_number}
                        onChange={(e) => setForm({ ...form, agency_number: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Conta com dígito</span>
                      <input
                        className={campo}
                        inputMode="numeric"
                        value={form.account_number}
                        onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Tipo da chave Pix</span>
                      <select
                        className={campo}
                        value={form.pix_key_type}
                        onChange={(e) =>
                          setForm({ ...form, pix_key_type: e.target.value as TipoChavePix | "" })
                        }
                      >
                        <option value="">Sem chave Pix</option>
                        {(Object.keys(ROTULO_CHAVE_PIX) as TipoChavePix[]).map((t) => (
                          <option key={t} value={t}>
                            {ROTULO_CHAVE_PIX[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={rotulo}>Chave Pix</span>
                      <input
                        className={campo}
                        value={form.pix_key}
                        onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.principal}
                        onChange={(e) => setForm({ ...form, principal: e.target.checked })}
                      />
                      Usar como conta principal de repasse
                    </label>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
                      disabled={mSalvar.isPending}
                      onClick={() => mSalvar.mutate()}
                    >
                      {mSalvar.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                      Salvar conta
                    </button>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Antifraude: o CPF/CNPJ da conta precisa ser o mesmo documento do motorista
                      verificado na plataforma.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display text-lg font-bold">Extrato da carteira</h2>
                <ul className="mt-4 divide-y divide-border text-sm">
                  {movimentos.map((m) => (
                    <li key={m.id} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{ROTULO_MOVIMENTO[m.type]}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                        <p className="text-xs text-muted-foreground">{dataHora(m.created_at)}</p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${Number(m.amount) < 0 ? "text-destructive" : "text-primary"}`}
                      >
                        {brl(Number(m.amount))}
                      </span>
                    </li>
                  ))}
                  {movimentos.length === 0 && (
                    <li className="py-3 text-muted-foreground">
                      Nenhuma movimentação. Os ganhos entram ao concluir cada viagem.
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display text-lg font-bold">Repasses</h2>
                <ul className="mt-4 divide-y divide-border text-sm">
                  {repasses.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">
                          {brl(Number(r.net_amount))}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({r.payout_method} · {r.mode === "WEEKLY" ? "semanal" : "instantâneo"})
                          </span>
                        </p>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                          {ROTULO_STATUS_REPASSE[r.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Solicitado em {dataHora(r.created_at)}
                        {Number(r.fee) > 0 ? ` · taxa ${brl(Number(r.fee))}` : ""}
                        {r.failure_reason ? ` · ${r.failure_reason}` : ""}
                      </p>
                    </li>
                  ))}
                  {repasses.length === 0 && (
                    <li className="py-3 text-muted-foreground">Nenhum repasse solicitado ainda.</li>
                  )}
                </ul>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function CarteiraProtegida() {
  return (
    <GuardaPerfil perfis={["motorista", "frotista"]}>
      <CarteiraMotorista />
    </GuardaPerfil>
  );
}
