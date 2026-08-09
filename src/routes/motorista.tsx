import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  Route as RouteIcon,
  Trash2,
  Wrench,
} from "lucide-react";

import { TopNav } from "@/components/TopNav";
import { PortaoBiometriaMotorista } from "@/components/PortaoBiometriaMotorista";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { medirTrechoRota } from "@/utils/rota.functions";
import { consultarVagasPromo, resgatarPromoDaRota } from "@/utils/promocao.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { EmbarquesMotorista } from "@/components/EmbarquesMotorista";
import { useAuth } from "@/hooks/use-auth";
import { CONSUMO_KM_L, PRECO_COMBUSTIVEL } from "@/lib/dados";
import { SeletorCidade } from "@/components/SeletorCidade";

import { brl, calcularTarifa } from "@/lib/logistica";
import { excluirRota } from "@/lib/excluir-rota";

import {
  COR_STATUS_OPERACIONAL,
  MOTIVOS_INDISPONIBILIDADE,
  ROTULO_STATUS_OPERACIONAL,
  type StatusOperacional,
} from "@/lib/frotista";

export const Route = createFileRoute("/motorista")({
  head: () => ({
    meta: [
      { title: "Painel do motorista | RotaCerta Brasil" },
      {
        name: "description",
        content:
          "Cadastre rotas entre sedes, distritos e vilarejos, vincule os veículos da sua frota, registre manutenções e reative veículos aptos a operar.",
      },
      { property: "og:title", content: "Painel do motorista | RotaCerta" },
      {
        property: "og:description",
        content:
          "Rotas com horários, vínculo de veículos, controle de manutenção e aviso de indisponibilidade aos passageiros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Motorista,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface VeiculoRow {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  assentos: number;
  status_operacional: StatusOperacional;
}

interface RotaRow {
  id: string;
  origem: string;
  destino: string;
  uf_origem: string | null;
  uf_destino: string | null;

  saida_ida: string | null;
  chegada_ida: string | null;
  saida_retorno: string | null;
  chegada_retorno: string | null;
  distancia_km: number;
  assentos: number;
  travessias: number;
  dificuldade_via: number;
  preco_assento: number;
  status: string;
}

interface VinculoRow {
  id: string;
  rota_id: string;
  veiculo_id: string;
}

interface IndisponibilidadeRow {
  id: string;
  veiculo_id: string;
  rota_id: string | null;
  motivo: string;
  mensagem: string | null;
  inicio: string;
  retorno_previsto: string | null;
  resolvido_em: string | null;
}

function useDadosMotorista() {
  const { user } = useAuth();

  const veiculos = useQuery({
    queryKey: ["veiculos-motorista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, placa, marca, modelo, ano, assentos, status_operacional")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VeiculoRow[];
    },
  });

  const rotas = useQuery({
    queryKey: ["rotas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RotaRow[];
    },
  });

  const vinculos = useQuery({
    queryKey: ["rota-veiculos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("rota_veiculos").select("id, rota_id, veiculo_id");
      if (error) throw error;
      return (data ?? []) as unknown as VinculoRow[];
    },
  });

  const indisponibilidades = useQuery({
    queryKey: ["indisponibilidades", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculo_indisponibilidades")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IndisponibilidadeRow[];
    },
  });

  return { user, veiculos, rotas, vinculos, indisponibilidades };
}

function Motorista() {
  const [aba, setAba] = useState<"rotas" | "embarques" | "veiculo" | "avisos">("rotas");
  const { user, carregando } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-bold">Painel do motorista</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Publique suas saídas, vincule os veículos da sua frota a cada rota e controle manutenções
          sem deixar passageiros na mão.
        </p>

        <div className="mt-7 inline-flex rounded-full border border-border bg-card p-1">
          {(
            [
              ["rotas", "Rotas e horários", RouteIcon],
              ["embarques", "Embarques", MapPin],
              ["veiculo", "Frota", Car],
              ["avisos", "Manutenção", Wrench],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                aba === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {!user && !carregando ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <h2 className="text-lg font-bold">Entre para gerenciar suas rotas</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                O cadastro de rotas, o vínculo de veículos e o controle de manutenção ficam
                disponíveis depois do login.
              </p>
              <Link
                to="/auth"
                className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                Entrar na plataforma
              </Link>
            </div>
          ) : (
            <PortaoBiometriaMotorista>
              {aba === "rotas" && <AbaRotas />}
              {aba === "embarques" && <AbaEmbarques />}
              {aba === "veiculo" && <AbaFrota />}
              {aba === "avisos" && <AbaManutencao />}
            </PortaoBiometriaMotorista>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rotas e vínculo de veículos                                         */
/* ------------------------------------------------------------------ */

function AbaEmbarques() {
  const { rotas } = useDadosMotorista();
  const lista = (rotas.data ?? []).map((r) => ({
    id: r.id,
    origem: r.origem,
    destino: r.destino,
    uf_origem: r.uf_origem,
    uf_destino: r.uf_destino,
    saida_ida: r.saida_ida ?? null,
  }));

  if (lista.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Publique uma rota para começar a combinar pontos de embarque com os passageiros.
      </p>
    );
  }
  return <EmbarquesMotorista rotas={lista} />;
}

function AbaRotas() {
  const qc = useQueryClient();
  const { user, veiculos, rotas, vinculos } = useDadosMotorista();
  const [form, setForm] = useState({
    ufOrigem: "AP",
    origem: "Macapá",
    ufDestino: "AP",
    destino: "Mazagão",
    saidaIda: "06:15",
    chegadaIda: "08:10",
    saidaRetorno: "16:00",
    chegadaRetorno: "18:05",
    distancia: 120,
    assentos: 6,
    travessias: 1,
    dificuldade: 0.5,
  });
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const medir = useServerFn(medirTrechoRota);
  const resgatarPromo = useServerFn(resgatarPromoDaRota);

  const vagasPromo = useQuery({
    queryKey: ["promo-vagas"],
    staleTime: 1000 * 60 * 5,
    queryFn: () => consultarVagasPromo(),
  });
  const vagaNaUf = vagasPromo.data?.ativa
    ? (vagasPromo.data.ufs.find((u) => u.uf === form.ufOrigem)?.restantes ?? 0)
    : 0;

  const medida = useQuery({
    queryKey: ["medida-trecho", form.ufOrigem, form.origem, form.ufDestino, form.destino],
    enabled:
      !!form.origem &&
      !!form.destino &&
      !(form.origem === form.destino && form.ufOrigem === form.ufDestino),
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const r = await medir({
        data: {
          origem: form.origem,
          destino: form.destino,
          ufOrigem: form.ufOrigem,
          ufDestino: form.ufDestino,
        },
      });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
  });


  useEffect(() => {
    if (medida.data) setForm((f) => ({ ...f, distancia: medida.data.distanciaKm }));
  }, [medida.data]);

  const tarifa = useMemo(
    () =>
      calcularTarifa({
        distanciaKm: form.distancia,
        dificuldadeVia: form.dificuldade,
        precoCombustivel: PRECO_COMBUSTIVEL,
        consumoKmL: CONSUMO_KM_L,
        assentos: form.assentos,
        ocupacaoMedia: 0.78,
        travessias: form.travessias,
      }),
    [form],
  );

  const aptos = (veiculos.data ?? []).filter((v) => v.status_operacional === "ativo");

  const publicar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para publicar rotas.");
      if (selecionados.length === 0) {
        throw new Error("Selecione pelo menos um veículo da sua frota para operar a rota.");
      }
      const { data, error } = await supabase
        .from("rotas")
        .insert({
          user_id: user.id,
          origem: form.origem,
          destino: form.destino,
          uf_origem: form.ufOrigem,
          uf_destino: form.ufDestino,

          saida_ida: form.saidaIda,
          chegada_ida: form.chegadaIda,
          saida_retorno: form.saidaRetorno,
          chegada_retorno: form.chegadaRetorno,
          distancia_km: form.distancia,
          assentos: form.assentos,
          travessias: form.travessias,
          dificuldade_via: form.dificuldade,
          preco_assento: tarifa.precoAssento,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: erroVinculo } = await supabase
        .from("rota_veiculos")
        .insert(selecionados.map((veiculo_id) => ({ rota_id: data.id, veiculo_id })));
      if (erroVinculo) throw erroVinculo;
      // Cortesia de lançamento: 10 primeiros motoristas de cada estado.
      const promo = await resgatarPromo({
        data: { rotaId: data.id, uf: form.ufOrigem, environment: getStripeEnvironment() },
      });
      return promo;
    },
    onSuccess: (promo) => {
      toast.success("Rota publicada com os veículos vinculados.");
      if (promo?.concedida) {
        toast.success(
          `Cortesia de lançamento: você é o ${promo.posicao}º motorista de ${promo.uf} e ganhou 1 mês do ${promo.plano} sem custo, até ${new Date(promo.expiraEm).toLocaleDateString("pt-BR")}.`,
          { duration: 9000 },
        );
      }
      setSelecionados([]);
      void qc.invalidateQueries({ queryKey: ["rotas"] });
      void qc.invalidateQueries({ queryKey: ["rota-veiculos"] });
      void qc.invalidateQueries({ queryKey: ["promo-vagas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarVinculo = useMutation({
    mutationFn: async (dados: { rotaId: string; veiculoId: string; vincular: boolean }) => {
      if (dados.vincular) {
        const { error } = await supabase
          .from("rota_veiculos")
          .insert({ rota_id: dados.rotaId, veiculo_id: dados.veiculoId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rota_veiculos")
          .delete()
          .eq("rota_id", dados.rotaId)
          .eq("veiculo_id", dados.veiculoId);
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["rota-veiculos"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (rotaId: string) => excluirRota(rotaId),
    onSuccess: () => {
      toast.success("Rota excluída.");
      void qc.invalidateQueries({ queryKey: ["rotas"] });
      void qc.invalidateQueries({ queryKey: ["rota-veiculos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h2 data-tour="cadastro-rota" className="text-lg font-bold">Cadastrar rota</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sede, distrito ou vilarejo — informe também o trecho de retorno.
          </p>

          {vagasPromo.data?.ativa && vagaNaUf > 0 && (
            <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary">
              Lançamento RotaCerta: restam {vagaNaUf} de {vagasPromo.data.vagasPorUf} vagas gratuitas
              em {form.ufOrigem}. Publique sua primeira rota e ganhe {vagasPromo.data.dias} dias do
              Motorista Pro sem custo, sem cobrança automática no fim.
            </p>
          )}



          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SeletorCidade
                titulo="Ponto de origem"
                uf={form.ufOrigem}
                cidade={form.origem}
                onChange={({ uf, cidade }) =>
                  setForm((f) => ({ ...f, ufOrigem: uf, origem: cidade }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <SeletorCidade
                titulo="Ponto de destino"
                uf={form.ufDestino}
                cidade={form.destino}
                onChange={({ uf, cidade }) =>
                  setForm((f) => ({ ...f, ufDestino: uf, destino: cidade }))
                }
              />
              {form.ufOrigem !== form.ufDestino && form.origem && form.destino && (
                <p className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary">
                  Rota interestadual: {form.origem}/{form.ufOrigem} → {form.destino}/
                  {form.ufDestino}
                </p>
              )}
            </div>

            <label>
              <span className={rotulo}>Ponto A</span>
              <input
                type="time"
                className={campo}
                value={form.saidaIda}
                onChange={(e) => setForm({ ...form, saidaIda: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Ponto B</span>
              <input
                type="time"
                className={campo}
                value={form.chegadaIda}
                onChange={(e) => setForm({ ...form, chegadaIda: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Ponto B</span>
              <input
                type="time"
                className={campo}
                value={form.saidaRetorno}
                onChange={(e) => setForm({ ...form, saidaRetorno: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Ponto A</span>
              <input
                type="time"
                className={campo}
                value={form.chegadaRetorno}
                onChange={(e) => setForm({ ...form, chegadaRetorno: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>
                Distância (km) — medida automaticamente
              </span>
              <div className="relative">
                <input
                  type="number"
                  className={campo}
                  value={form.distancia}
                  onChange={(e) => setForm({ ...form, distancia: Number(e.target.value) })}
                />
                {medida.isFetching && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {medida.isFetching
                  ? "Calculando o trecho A → B pela malha viária…"
                  : medida.data
                    ? `${medida.data.distanciaKm} km · ${medida.data.duracaoMin} min (${
                        medida.data.provedor === "google_routes"
                          ? "Google Routes"
                          : "estimativa geodésica"
                      })`
                    : medida.error
                      ? (medida.error as Error).message
                      : "Escolha origem e destino para medir automaticamente."}
              </span>
            </label>
            <label>
              <span className={rotulo}>Assentos ofertados</span>
              <input
                type="number"
                className={campo}
                value={form.assentos}
                onChange={(e) =>
                  setForm({ ...form, assentos: Math.max(1, Number(e.target.value)) })
                }
              />
            </label>
            <label>
              <span className={rotulo}>Travessias de balsa / pedágios</span>
              <input
                type="number"
                min={0}
                className={campo}
                value={form.travessias}
                onChange={(e) => setForm({ ...form, travessias: Number(e.target.value) })}
              />
            </label>
            <label>
              <span className={rotulo}>
                Dificuldade da via: {(form.dificuldade * 100).toFixed(0)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                className="mt-3 w-full accent-[var(--accent)]"
                value={form.dificuldade}
                onChange={(e) => setForm({ ...form, dificuldade: Number(e.target.value) })}
              />
            </label>
          </div>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Veículos que vão operar esta rota
          </h3>
          {veiculos.isLoading ? (
            <p className="mt-3 text-xs text-muted-foreground">Carregando sua frota…</p>
          ) : aptos.length === 0 ? (
            <p className="mt-3 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
              Nenhum veículo ativo na sua frota. Cadastre um veículo em{" "}
              <Link to="/verificacao" className="font-semibold underline">
                Idoneidade e veículos
              </Link>{" "}
              ou reative um veículo em manutenção na aba Manutenção.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {aptos.map((v) => {
                const marcado = selecionados.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      setSelecionados((atual) =>
                        marcado ? atual.filter((i) => i !== v.id) : [...atual, v.id],
                      )
                    }
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left text-sm transition-colors ${
                      marcado ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span>
                      <span className="font-semibold">
                        {v.marca} {v.modelo}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {v.placa} · {v.ano} · {v.assentos} assentos
                      </span>
                    </span>
                    {marcado && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => publicar.mutate()}
            disabled={publicar.isPending}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {publicar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Publicar rota
          </button>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Minhas rotas publicadas
          </h3>
          {(rotas.data ?? []).length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">Nenhuma rota publicada ainda.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {(rotas.data ?? []).map((r) => {
                const vinculados = (vinculos.data ?? [])
                  .filter((v) => v.rota_id === r.id)
                  .map((v) => v.veiculo_id);
                return (
                  <li key={r.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {r.origem}/{r.uf_origem ?? "AP"} → {r.destino}/{r.uf_destino ?? "AP"}

                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.saida_ida?.slice(0, 5) ?? "--:--"} –{" "}
                          {r.chegada_ida?.slice(0, 5) ?? "--:--"} · retorno{" "}
                          {r.saida_retorno?.slice(0, 5) ?? "--:--"} · {r.assentos} assentos ·{" "}
                          {brl(Number(r.preco_assento))}/assento
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          r.status === "ativa"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {r.status === "ativa" ? "Ativa" : "Suspensa"}
                      </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Excluir a rota ${r.origem} → ${r.destino}? Esta ação não pode ser desfeita.`,
                              )
                            ) {
                              excluir.mutate(r.id);
                            }
                          }}
                          disabled={excluir.isPending}
                          title="Excluir rota"
                          aria-label={`Excluir rota ${r.origem} para ${r.destino}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {excluir.isPending && excluir.variables === r.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>


                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Veículos vinculados
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(veiculos.data ?? []).map((v) => {
                        const marcado = vinculados.includes(v.id);
                        const bloqueado = v.status_operacional !== "ativo" && !marcado;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={bloqueado || alternarVinculo.isPending}
                            onClick={() =>
                              alternarVinculo.mutate({
                                rotaId: r.id,
                                veiculoId: v.id,
                                vincular: !marcado,
                              })
                            }
                            title={
                              bloqueado
                                ? "Veículo indisponível: conclua a manutenção para vinculá-lo."
                                : undefined
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                              marcado
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {v.placa}
                            {v.status_operacional !== "ativo" &&
                              ` · ${ROTULO_STATUS_OPERACIONAL[v.status_operacional]}`}
                          </button>
                        );
                      })}
                    </div>
                    {vinculados.length === 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="size-3.5" /> Sem veículo apto: a rota não pode
                        operar.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="rounded-3xl border border-border surface-night p-6 text-primary-foreground shadow-[var(--shadow-lift)] lg:sticky lg:top-24 lg:self-start">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Brain className="size-4 text-accent" /> Tarifa sugerida pela IA
        </h2>
        <p className="mt-4 font-display text-3xl font-bold text-accent">
          {brl(tarifa.precoAssento)}
        </p>
        <p className="text-xs text-primary-foreground/60">por assento</p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Custo operacional</dt>
            <dd>{brl(tarifa.custoOperacional)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Faixa aceitável</dt>
            <dd>
              {brl(tarifa.faixaMin)} – {brl(tarifa.faixaMax)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-primary-foreground/65">Assento de bagagem</dt>
            <dd>{brl(tarifa.precoAssentoBagagem)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] leading-relaxed text-primary-foreground/55">
          {tarifa.detalhe}. A calibração usa os dados dos motoristas já cadastrados na região e é
          reajustada conforme ocupação real, preço do combustível e condição das vias.
        </p>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Frota                                                               */
/* ------------------------------------------------------------------ */

function AbaFrota() {
  const { veiculos, vinculos, rotas } = useDadosMotorista();

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Frota cadastrada</h2>
        <Link
          to="/verificacao"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          <Plus className="size-4" /> Cadastrar veículo
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada veículo é cadastrado com placa, Renavam e CRLV na área de idoneidade. Aqui você
        acompanha a situação operacional e as rotas em que ele opera.
      </p>

      {veiculos.isLoading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : (veiculos.data ?? []).length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">Nenhum veículo cadastrado.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {(veiculos.data ?? []).map((v) => {
            const rotasDoVeiculo = (vinculos.data ?? [])
              .filter((x) => x.veiculo_id === v.id)
              .map((x) => (rotas.data ?? []).find((r) => r.id === x.rota_id))
              .filter(Boolean);
            return (
              <li key={v.id} className="rounded-2xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {v.marca} {v.modelo}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {v.placa} · {v.ano}
                    </span>
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      COR_STATUS_OPERACIONAL[v.status_operacional]
                    }`}
                  >
                    {ROTULO_STATUS_OPERACIONAL[v.status_operacional]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v.assentos} assentos ·{" "}
                  {rotasDoVeiculo.length === 0
                    ? "sem rota vinculada"
                    : rotasDoVeiculo
                        .map((r) => `${r?.origem} → ${r?.destino}`)
                        .join(" | ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Manutenção / indisponibilidade                                      */
/* ------------------------------------------------------------------ */

function AbaManutencao() {
  const qc = useQueryClient();
  const { user, veiculos, rotas, indisponibilidades } = useDadosMotorista();
  const ativos = (veiculos.data ?? []).filter((v) => v.status_operacional === "ativo");
  const [form, setForm] = useState({
    veiculoId: "",
    rotaId: "",
    motivo: MOTIVOS_INDISPONIBILIDADE[0] as string,
    inicio: new Date().toISOString().slice(0, 10),
    retorno: "",
    mensagem: "Veículo em manutenção. Retorno previsto em breve.",
  });

  const abertas = (indisponibilidades.data ?? []).filter((i) => !i.resolvido_em);

  const registrar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para registrar manutenções.");
      const veiculoId = form.veiculoId || ativos[0]?.id;
      if (!veiculoId) throw new Error("Nenhum veículo ativo para colocar em manutenção.");
      const { error } = await supabase.from("veiculo_indisponibilidades").insert({
        user_id: user.id,
        veiculo_id: veiculoId,
        rota_id: form.rotaId || null,
        motivo: form.motivo,
        mensagem: form.mensagem,
        inicio: form.inicio,
        retorno_previsto: form.retorno || null,
      });
      if (error) throw error;
      const { error: erroStatus } = await supabase
        .from("veiculos")
        .update({ status_operacional: "manutencao" })
        .eq("id", veiculoId);
      if (erroStatus) throw erroStatus;
    },
    onSuccess: () => {
      toast.success("Indisponibilidade registrada. O veículo saiu da operação das rotas.");
      void qc.invalidateQueries({ queryKey: ["indisponibilidades"] });
      void qc.invalidateQueries({ queryKey: ["veiculos-motorista"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reativar = useMutation({
    mutationFn: async (dados: { id: string; veiculoId: string }) => {
      const { error } = await supabase
        .from("veiculo_indisponibilidades")
        .update({ resolvido_em: new Date().toISOString() })
        .eq("id", dados.id);
      if (error) throw error;
      const { error: erroStatus } = await supabase
        .from("veiculos")
        .update({ status_operacional: "ativo" })
        .eq("id", dados.veiculoId);
      if (erroStatus) throw erroStatus;
    },
    onSuccess: () => {
      toast.success("Manutenção concluída: veículo reativado e apto a operar nas rotas.");
      void qc.invalidateQueries({ queryKey: ["indisponibilidades"] });
      void qc.invalidateQueries({ queryKey: ["veiculos-motorista"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Registrar indisponibilidade</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O veículo sai da operação e os passageiros com reserva nas rotas afetadas são avisados.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className={rotulo}>Veículo</span>
            <select
              className={campo}
              value={form.veiculoId}
              onChange={(e) => setForm({ ...form, veiculoId: e.target.value })}
            >
              <option value="">Selecione um veículo ativo</option>
              {ativos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} · {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Motivo</span>
            <select
              className={campo}
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            >
              {MOTIVOS_INDISPONIBILIDADE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Rota afetada (opcional)</span>
            <select
              className={campo}
              value={form.rotaId}
              onChange={(e) => setForm({ ...form, rotaId: e.target.value })}
            >
              <option value="">Todas as rotas do veículo</option>
              {(rotas.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.origem} → {r.destino} ({r.saida_ida?.slice(0, 5) ?? "--:--"})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={rotulo}>Início</span>
              <input
                type="date"
                className={campo}
                value={form.inicio}
                onChange={(e) => setForm({ ...form, inicio: e.target.value })}
              />
            </label>
            <label>
              <span className={rotulo}>Retorno previsto</span>
              <input
                type="date"
                className={campo}
                value={form.retorno}
                onChange={(e) => setForm({ ...form, retorno: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className={rotulo}>Mensagem aos passageiros</span>
            <textarea
              className={`${campo} min-h-24`}
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            />
          </label>
        </div>
        <button
          onClick={() => registrar.mutate()}
          disabled={registrar.isPending}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {registrar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wrench className="size-4" />
          )}
          Colocar veículo em manutenção
        </button>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Veículos em manutenção</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Concluiu o serviço? Reative o veículo para que volte a operar nas rotas vinculadas.
        </p>
        {abertas.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Nenhum veículo indisponível. Sua frota está toda apta.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {abertas.map((i) => {
              const v = (veiculos.data ?? []).find((x) => x.id === i.veiculo_id);
              return (
                <li key={i.id} className="rounded-2xl border border-border p-4 text-sm">
                  <p className="font-semibold">
                    {v ? `${v.placa} · ${v.marca} ${v.modelo}` : "Veículo"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.motivo} · desde {new Date(`${i.inicio}T12:00:00`).toLocaleDateString("pt-BR")}
                    {i.retorno_previsto
                      ? ` · retorno previsto ${new Date(`${i.retorno_previsto}T12:00:00`).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                  {i.mensagem && <p className="mt-2 text-xs">{i.mensagem}</p>}
                  <button
                    onClick={() => reativar.mutate({ id: i.id, veiculoId: i.veiculo_id })}
                    disabled={reativar.isPending}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 text-xs font-semibold text-success-foreground disabled:opacity-60"
                  >
                    {reativar.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Concluir manutenção e reativar
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="mt-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Histórico resolvido
        </h3>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          {(indisponibilidades.data ?? [])
            .filter((i) => i.resolvido_em)
            .slice(0, 5)
            .map((i) => {
              const v = (veiculos.data ?? []).find((x) => x.id === i.veiculo_id);
              return (
                <li key={i.id}>
                  {v?.placa ?? "Veículo"} · {i.motivo} · reativado em{" "}
                  {new Date(i.resolvido_em as string).toLocaleDateString("pt-BR")}
                </li>
              );
            })}
          {(indisponibilidades.data ?? []).filter((i) => i.resolvido_em).length === 0 && (
            <li>Nenhum registro concluído ainda.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
