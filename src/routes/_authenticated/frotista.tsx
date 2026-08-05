import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  COR_STATUS_OPERACIONAL,
  MIN_VEICULOS_FROTISTA,
  ROTULO_STATUS_OPERACIONAL,
  cnpjValido,
  formatarCnpj,
  frotistaLiberado,
  somenteDigitos,
  veiculosFaltantes,
  type StatusOperacional,
} from "@/lib/frotista";

export const Route = createFileRoute("/_authenticated/frotista")({
  head: () => ({
    meta: [
      { title: "Sou frotista | RotaCerta Amapá" },
      {
        name: "description",
        content:
          "Área corporativa para pessoas jurídicas: cadastro por CNPJ, frota mínima de 6 veículos, motoristas associados e rotas consolidadas.",
      },
      { property: "og:title", content: "Sou frotista | RotaCerta" },
      {
        property: "og:description",
        content: "Gestão corporativa de frota, motoristas e rotas intermunicipais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Frotista,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface FrotistaRow {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  responsavel_nome: string;
  email_contato: string | null;
  telefone: string | null;
  municipio: string | null;
  status: string;
}

interface VeiculoRow {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  assentos: number;
  categoria: string;
  status_operacional: StatusOperacional;
  frotista_id: string | null;
}

interface MotoristaRow {
  id: string;
  nome: string;
  cpf: string | null;
  cnh: string | null;
  telefone: string | null;
  status: string;
}

interface RotaRow {
  id: string;
  origem: string;
  destino: string;
  saida_ida: string | null;
  assentos: number;
  preco_assento: number;
  status: string;
  frotista_id: string | null;
}

function Frotista() {
  const { user } = useAuth();
  const empresa = useQuery({
    queryKey: ["frotista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("frotistas").select("*").maybeSingle();
      if (error) throw error;
      return (data as FrotistaRow | null) ?? null;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Building2 className="size-3.5" /> Perfil corporativo · pessoa jurídica
        </span>
        <h1 className="mt-3 text-3xl font-bold">Sou frotista</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Transporte intermunicipal com hora marcada operado por empresa: cadastro validado por
          CNPJ, quota mínima de {MIN_VEICULOS_FROTISTA} veículos, motoristas associados e visão
          consolidada das rotas corporativas.
        </p>

        <div className="mt-8">
          {empresa.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados da empresa…</p>
          ) : empresa.data ? (
            <PainelFrotista empresa={empresa.data} />
          ) : (
            <CadastroFrotista />
          )}
        </div>
      </main>
    </div>
  );
}

function CadastroFrotista() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    responsavel: "",
    email: "",
    telefone: "",
    municipio: "",
  });

  const cnpjOk = cnpjValido(form.cnpj);

  const criar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para cadastrar a empresa.");
      if (!cnpjOk) throw new Error("CNPJ inválido: confira os 14 dígitos informados.");
      if (form.razaoSocial.trim().length < 3) throw new Error("Informe a razão social.");
      if (form.responsavel.trim().length < 3) throw new Error("Informe o responsável legal.");
      const { error } = await supabase.from("frotistas").insert({
        user_id: user.id,
        cnpj: somenteDigitos(form.cnpj),
        razao_social: form.razaoSocial.trim(),
        nome_fantasia: form.nomeFantasia.trim() || null,
        responsavel_nome: form.responsavel.trim(),
        email_contato: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        municipio: form.municipio.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa cadastrada. Agora registre a frota mínima para liberar a operação.");
      void qc.invalidateQueries({ queryKey: ["frotista"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Cadastro da pessoa jurídica</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Somente empresas com CNPJ regular podem operar como frotista. Pessoas físicas devem usar a
          área{" "}
          <Link to="/motorista" className="font-semibold underline">
            Sou motorista
          </Link>
          .
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={rotulo}>CNPJ</span>
            <input
              className={campo}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={formatarCnpj(form.cnpj)}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
            {form.cnpj.length > 0 && (
              <span
                className={`mt-1.5 block text-xs font-medium ${
                  cnpjOk ? "text-success" : "text-destructive"
                }`}
              >
                {cnpjOk ? "CNPJ válido." : "CNPJ inválido — verifique os dígitos."}
              </span>
            )}
          </label>
          <label>
            <span className={rotulo}>Razão social</span>
            <input
              className={campo}
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
            />
          </label>
          <label>
            <span className={rotulo}>Nome fantasia</span>
            <input
              className={campo}
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            />
          </label>
          <label>
            <span className={rotulo}>Responsável legal</span>
            <input
              className={campo}
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            />
          </label>
          <label>
            <span className={rotulo}>E-mail corporativo</span>
            <input
              type="email"
              className={campo}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            <span className={rotulo}>Telefone</span>
            <input
              className={campo}
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </label>
          <label>
            <span className={rotulo}>Município sede</span>
            <input
              className={campo}
              value={form.municipio}
              onChange={(e) => setForm({ ...form, municipio: e.target.value })}
            />
          </label>
        </div>
        <button
          onClick={() => criar.mutate()}
          disabled={criar.isPending}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {criar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Building2 className="size-4" />
          )}
          Criar conta corporativa
        </button>
      </div>

      <aside className="rounded-3xl border border-border surface-night p-6 text-primary-foreground">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4 text-accent" /> Regras do perfil frotista
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-primary-foreground/75">
          <li>CNPJ obrigatório e validado pelos dígitos verificadores.</li>
          <li>
            Quota mínima de <strong>{MIN_VEICULOS_FROTISTA} veículos</strong> cadastrados para
            liberar a operação.
          </li>
          <li>Motoristas associados à empresa com CPF e CNH registrados.</li>
          <li>Rotas corporativas com visão consolidada de frota e horários.</li>
        </ul>
      </aside>
    </div>
  );
}

function PainelFrotista({ empresa }: { empresa: FrotistaRow }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const veiculos = useQuery({
    queryKey: ["frotista-veiculos", empresa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select(
          "id, placa, marca, modelo, ano, assentos, categoria, status_operacional, frotista_id",
        )
        .eq("frotista_id", empresa.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VeiculoRow[];
    },
  });

  const motoristas = useQuery({
    queryKey: ["frotista-motoristas", empresa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frotista_motoristas")
        .select("id, nome, cpf, cnh, telefone, status")
        .eq("frotista_id", empresa.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MotoristaRow[];
    },
  });

  const rotas = useQuery({
    queryKey: ["frotista-rotas", empresa.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select("id, origem, destino, saida_ida, assentos, preco_assento, status, frotista_id")
        .eq("frotista_id", empresa.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RotaRow[];
    },
  });

  const total = (veiculos.data ?? []).length;
  const liberado = frotistaLiberado(total);
  const faltam = veiculosFaltantes(total);
  const progresso = Math.min(100, (total / MIN_VEICULOS_FROTISTA) * 100);

  const [veiculo, setVeiculo] = useState({
    placa: "",
    marca: "",
    modelo: "",
    ano: new Date().getFullYear(),
    assentos: 12,
    categoria: "van",
  });
  const [motorista, setMotorista] = useState({ nome: "", cpf: "", cnh: "", telefone: "" });

  const addVeiculo = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      if (veiculo.placa.trim().length < 7) throw new Error("Informe a placa completa.");
      if (!veiculo.marca.trim() || !veiculo.modelo.trim())
        throw new Error("Informe marca e modelo do veículo.");
      const { error } = await supabase.from("veiculos").insert({
        user_id: user.id,
        frotista_id: empresa.id,
        placa: veiculo.placa.trim().toUpperCase(),
        marca: veiculo.marca.trim(),
        modelo: veiculo.modelo.trim(),
        ano: veiculo.ano,
        assentos: veiculo.assentos,
        categoria: veiculo.categoria,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Veículo adicionado à frota corporativa.");
      setVeiculo({ ...veiculo, placa: "", marca: "", modelo: "" });
      void qc.invalidateQueries({ queryKey: ["frotista-veiculos", empresa.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMotorista = useMutation({
    mutationFn: async () => {
      if (motorista.nome.trim().length < 3) throw new Error("Informe o nome do motorista.");
      const { error } = await supabase.from("frotista_motoristas").insert({
        frotista_id: empresa.id,
        nome: motorista.nome.trim(),
        cpf: somenteDigitos(motorista.cpf),
        cnh: motorista.cnh.trim() || null,
        telefone: motorista.telefone.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Motorista associado à empresa.");
      setMotorista({ nome: "", cpf: "", cnh: "", telefone: "" });
      void qc.invalidateQueries({ queryKey: ["frotista-motoristas", empresa.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho da empresa + quota */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{empresa.nome_fantasia || empresa.razao_social}</h2>
            <p className="text-xs text-muted-foreground">
              CNPJ {formatarCnpj(empresa.cnpj)} · responsável {empresa.responsavel_nome}
              {empresa.municipio ? ` · ${empresa.municipio}` : ""}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              liberado ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {liberado ? <CheckCircle2 className="size-3.5" /> : <Lock className="size-3.5" />}
            {liberado ? "Operação liberada" : "Operação bloqueada"}
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>
              Quota de frota: {total} de {MIN_VEICULOS_FROTISTA} veículos
            </span>
            <span>{progresso.toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${liberado ? "bg-success" : "bg-accent"}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
          {!liberado && (
            <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
              Faltam {faltam} {faltam === 1 ? "veículo" : "veículos"} para concluir o cadastro
              corporativo. Enquanto a quota mínima de {MIN_VEICULOS_FROTISTA} veículos não for
              atingida, a empresa não pode publicar rotas nem receber reservas.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Frota */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Truck className="size-4" /> Frota corporativa
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className={rotulo}>Placa</span>
              <input
                className={campo}
                value={veiculo.placa}
                onChange={(e) => setVeiculo({ ...veiculo, placa: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Categoria</span>
              <select
                className={campo}
                value={veiculo.categoria}
                onChange={(e) => setVeiculo({ ...veiculo, categoria: e.target.value })}
              >
                <option value="van">Van</option>
                <option value="micro-onibus">Micro-ônibus</option>
                <option value="onibus">Ônibus</option>
                <option value="carro">Carro</option>
                <option value="utilitario">Utilitário</option>
              </select>
            </label>
            <label>
              <span className={rotulo}>Marca</span>
              <input
                className={campo}
                value={veiculo.marca}
                onChange={(e) => setVeiculo({ ...veiculo, marca: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Modelo</span>
              <input
                className={campo}
                value={veiculo.modelo}
                onChange={(e) => setVeiculo({ ...veiculo, modelo: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Ano</span>
              <input
                type="number"
                className={campo}
                value={veiculo.ano}
                onChange={(e) => setVeiculo({ ...veiculo, ano: Number(e.target.value) })}
              />
            </label>
            <label>
              <span className={rotulo}>Assentos</span>
              <input
                type="number"
                className={campo}
                value={veiculo.assentos}
                onChange={(e) => setVeiculo({ ...veiculo, assentos: Number(e.target.value) })}
              />
            </label>
          </div>
          <button
            onClick={() => addVeiculo.mutate()}
            disabled={addVeiculo.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {addVeiculo.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Adicionar veículo
          </button>

          <ul className="mt-5 space-y-2 text-sm">
            {(veiculos.data ?? []).map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3"
              >
                <span>
                  <span className="font-semibold">{v.placa}</span>
                  <span className="block text-xs text-muted-foreground">
                    {v.marca} {v.modelo} · {v.ano} · {v.assentos} assentos · {v.categoria}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    COR_STATUS_OPERACIONAL[v.status_operacional]
                  }`}
                >
                  {ROTULO_STATUS_OPERACIONAL[v.status_operacional]}
                </span>
              </li>
            ))}
            {total === 0 && (
              <li className="text-xs text-muted-foreground">Nenhum veículo cadastrado ainda.</li>
            )}
          </ul>
        </div>

        {/* Motoristas */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Users className="size-4" /> Motoristas associados
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={rotulo}>Nome completo</span>
              <input
                className={campo}
                value={motorista.nome}
                onChange={(e) => setMotorista({ ...motorista, nome: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>CPF</span>
              <input
                className={campo}
                inputMode="numeric"
                value={motorista.cpf}
                onChange={(e) => setMotorista({ ...motorista, cpf: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>CNH</span>
              <input
                className={campo}
                value={motorista.cnh}
                onChange={(e) => setMotorista({ ...motorista, cnh: e.target.value })}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={rotulo}>Telefone</span>
              <input
                className={campo}
                value={motorista.telefone}
                onChange={(e) => setMotorista({ ...motorista, telefone: e.target.value })}
              />
            </label>
          </div>
          <button
            onClick={() => addMotorista.mutate()}
            disabled={addMotorista.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {addMotorista.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Associar motorista
          </button>

          <ul className="mt-5 space-y-2 text-sm">
            {(motoristas.data ?? []).map((m) => (
              <li key={m.id} className="rounded-2xl border border-border p-3">
                <span className="font-semibold">{m.nome}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.cnh ? `CNH ${m.cnh}` : "CNH não informada"}
                  {m.telefone ? ` · ${m.telefone}` : ""} · {m.status}
                </span>
              </li>
            ))}
            {(motoristas.data ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground">Nenhum motorista associado.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Rotas consolidadas */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-lg font-bold">Rotas corporativas</h3>
        {!liberado ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> A publicação de rotas é liberada após atingir a quota
            mínima de {MIN_VEICULOS_FROTISTA} veículos.
          </p>
        ) : (rotas.data ?? []).length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Operação liberada. Publique rotas na área{" "}
            <Link to="/motorista" className="font-semibold underline">
              de rotas e horários
            </Link>{" "}
            e vincule os veículos da frota corporativa.
          </p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {(rotas.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3"
              >
                <span>
                  <span className="font-medium">
                    {r.origem} → {r.destino}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {r.saida_ida?.slice(0, 5) ?? "--:--"} · {r.assentos} assentos · R${" "}
                    {Number(r.preco_assento).toFixed(2)}
                  </span>
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
