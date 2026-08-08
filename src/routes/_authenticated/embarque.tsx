import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calculator, Clock, Handshake, Loader2, MapPin, Navigation } from "lucide-react";
import { AcompanhamentoAoVivo } from "@/components/AcompanhamentoAoVivo";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { localizarEndereco } from "@/utils/embarque.functions";
import { estimarPrecoPontoRota } from "@/utils/desvio.functions";
import { brl } from "@/lib/logistica";
import { COR_STATUS_PONTO, STATUS_PONTO, horaLocal, type StatusPonto } from "@/lib/embarque";
import { GuardaPerfil } from "@/components/GuardaPerfil";

export const Route = createFileRoute("/_authenticated/embarque")({
  head: () => ({
    meta: [
      { title: "Combinar ponto de embarque | RotaCerta" },
      {
        name: "description",
        content:
          "Proponha ao motorista o ponto onde você será apanhado, acompanhe o acordo e veja o horário estimado de chegada do veículo ao seu ponto.",
      },
      { property: "og:title", content: "Combinar ponto de embarque | RotaCerta" },
      {
        property: "og:description",
        content:
          "Acordo de ponto de embarque com rota otimizada por georreferenciamento e horário de saída garantido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmbarqueProtegido,
});

const campo =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";
const rotulo = "mb-1.5 block text-xs font-semibold text-muted-foreground";

interface RotaOferta {
  id: string;
  origem: string;
  destino: string;
  saida_ida: string | null;
  preco_assento: number;
}

interface PontoRow {
  id: string;
  rota_id: string;
  data_viagem: string;
  endereco: string;
  referencia: string | null;
  assentos: number;
  status: StatusPonto;
  motivo: string | null;
  contra_endereco: string | null;
  ordem: number | null;
  eta_ponto: string | null;
  saida_motorista: string | null;
}

function Embarque() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const geocodificar = useServerFn(localizarEndereco);
  const estimarPreco = useServerFn(estimarPrecoPontoRota);

  const [rotaId, setRotaId] = useState("");
  const [dataViagem, setDataViagem] = useState(() => new Date().toISOString().slice(0, 10));
  const [endereco, setEndereco] = useState("");
  const [referencia, setReferencia] = useState("");
  const [assentos, setAssentos] = useState(1);

  const rotas = useQuery({
    queryKey: ["rotas-ofertadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas")
        .select("id, origem, destino, uf_origem, uf_destino, saida_ida, preco_assento")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RotaOferta[];
    },
  });

  const pontos = useQuery({
    queryKey: ["meus-pontos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_embarque")
        .select(
          "id, rota_id, data_viagem, endereco, referencia, assentos, status, motivo, contra_endereco, ordem, eta_ponto, saida_motorista",
        )
        .eq("passageiro_id", user!.id)
        .order("data_viagem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PontoRow[];
    },
  });

  const rotaEscolhida = useMemo(
    () => (rotas.data ?? []).find((r) => r.id === rotaId) ?? null,
    [rotas.data, rotaId],
  );

  // O cálculo do desvio é prioritário: roda automaticamente (debounce) assim que
  // a rota é escolhida e o endereço está detalhado, antes de liberar a proposta.
  const [enderecoDebounce, setEnderecoDebounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setEnderecoDebounce(endereco.trim()), 700);
    return () => clearTimeout(t);
  }, [endereco]);

  const estimativa = useQuery({
    queryKey: ["estimativa-desvio", rotaId, enderecoDebounce],
    enabled: !!rotaId && enderecoDebounce.length >= 6,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await estimarPreco({ data: { rotaId, endereco: enderecoDebounce } });
      if ("error" in r) throw new Error(r.error);
      return r;
    },
  });



  const propor = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para combinar o ponto.");
      if (!rotaId) throw new Error("Escolha a saída desejada.");
      const local = await geocodificar({
        data: { endereco, ...(rotaEscolhida?.uf_origem ? { uf: rotaEscolhida.uf_origem } : {}) },
      });

      if ("error" in local) throw new Error(local.error);

      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome_completo, telefone")
        .eq("id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("pontos_embarque").upsert(
        {
          rota_id: rotaId,
          data_viagem: dataViagem,
          passageiro_id: user.id,
          passageiro_nome: perfil?.nome_completo || (user.email ?? "Passageiro"),
          telefone: perfil?.telefone ?? null,
          assentos,
          endereco: local.enderecoFormatado,
          referencia: referencia || null,
          latitude: local.latitude,
          longitude: local.longitude,
          status: "proposto",
          motivo: null,
          ordem: null,
          eta_ponto: null,
          saida_motorista: null,
        },
        { onConflict: "rota_id,data_viagem,passageiro_id" },
      );
      if (error) throw error;
      return local.enderecoFormatado;
    },
    onSuccess: (formatado) => {
      toast.success(`Ponto enviado ao motorista: ${formatado}`);
      setEndereco("");
      setReferencia("");
      void qc.invalidateQueries({ queryKey: ["meus-pontos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const responderContra = useMutation({
    mutationFn: async (dados: { id: string; aceitar: boolean }) => {
      const { data: atual, error: erroLeitura } = await supabase
        .from("pontos_embarque")
        .select("contra_endereco, contra_latitude, contra_longitude")
        .eq("id", dados.id)
        .single();
      if (erroLeitura) throw erroLeitura;

      // Aceitar a contraproposta adota o endereço e as coordenadas sugeridas.
      const adocao =
        atual.contra_endereco && atual.contra_latitude != null && atual.contra_longitude != null
          ? {
              endereco: atual.contra_endereco,
              latitude: atual.contra_latitude,
              longitude: atual.contra_longitude,
            }
          : {};

      const { error } = await supabase
        .from("pontos_embarque")
        .update(dados.aceitar ? { status: "aceito", ...adocao } : { status: "cancelado" })
        .eq("id", dados.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resposta registrada.");
      void qc.invalidateQueries({ queryKey: ["meus-pontos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-3xl font-bold">Combine onde o motorista vai te apanhar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você indica o ponto, o motorista aceita ou sugere outro. Com o acordo fechado, a rota de
          busca é traçada por georreferenciamento e o horário de saída da viagem continua garantido.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <MapPin className="size-4 text-accent" /> Propor ponto
            </h2>
            <div className="mt-5 space-y-3">
              <label className="block">
                <span className={rotulo}>Saída</span>
                <select className={campo} value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
                  <option value="">Selecione a rota</option>
                  {(rotas.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.origem} → {r.destino} · {(r.saida_ida ?? "").slice(0, 5)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={rotulo}>Data da viagem</span>
                <input
                  type="date"
                  className={campo}
                  value={dataViagem}
                  onChange={(e) => setDataViagem(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={rotulo}>Endereço do ponto</span>
                <input
                  className={campo}
                  placeholder="Rua, número, bairro, município"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={rotulo}>Ponto de referência (opcional)</span>
                <input
                  className={campo}
                  placeholder="Em frente à escola, portão azul…"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={rotulo}>Assentos</span>
                <input
                  type="number"
                  min={1}
                  max={8}
                  className={campo}
                  value={assentos}
                  onChange={(e) => setAssentos(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <div className="rounded-2xl bg-secondary p-4 text-sm">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Calculator className="size-3.5 text-accent" /> Preço do assento com desvio
                </p>
                {!rotaId || enderecoDebounce.trim().length < 6 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Escolha a saída e digite o endereço do ponto — o cálculo aparece aqui
                    automaticamente antes do envio da proposta.
                  </p>
                ) : estimativa.isFetching ? (
                  <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Medindo o desvio na malha viária…
                  </p>
                ) : estimativa.error ? (
                  <p className="mt-2 text-[11px] text-destructive">
                    {(estimativa.error as Error).message}
                  </p>
                ) : estimativa.data ? (
                  <>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {estimativa.data.enderecoFormatado}
                    </p>
                    <dl className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Assento base</dt>
                        <dd>{brl(estimativa.data.precoBase)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          Desvio (Δkm {estimativa.data.metricas.kmExtra} · Δmin{" "}
                          {estimativa.data.metricas.minutosExtra})
                        </dt>
                        <dd>{brl(estimativa.data.taxaDesvio)}</dd>
                      </div>
                      <div className="flex justify-between border-t border-border pt-1 font-bold">
                        <dt>Total do assento</dt>
                        <dd>{brl(estimativa.data.precoTotalAssento)}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      taxa = Δkm · custo_km + Δmin · custo_min · preço = base + taxa. Cálculo por{" "}
                      {estimativa.data.metricas.provedor === "google_routes"
                        ? "malha viária real (Google Routes)"
                        : "estimativa geodésica"}
                      . O valor final vale após o motorista aceitar o ponto.
                    </p>
                  </>
                ) : null}
              </div>
              <button
                onClick={() => propor.mutate()}
                disabled={propor.isPending || !estimativa.data || estimativa.isFetching}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {propor.isPending ? <Loader2 className="size-4 animate-spin" /> : <Handshake className="size-4" />}
                Enviar proposta ao motorista
              </button>
              {!estimativa.data && (
                <p className="text-[11px] text-muted-foreground">
                  A proposta é liberada somente depois do cálculo do desvio.
                </p>
              )}

              {rotaEscolhida && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Partida programada às {(rotaEscolhida.saida_ida ?? "").slice(0, 5)} — o motorista
                  sai antes disso para percorrer os pontos combinados.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Meus pontos combinados
            </h2>
            {(pontos.data ?? []).map((p) => {
              const rota = (rotas.data ?? []).find((r) => r.id === p.rota_id);
              return (
                <article
                  key={p.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-base font-bold">
                        {rota ? `${rota.origem} → ${rota.destino}` : "Rota"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.data_viagem} · {p.assentos} assento(s)
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${COR_STATUS_PONTO[p.status]}`}
                    >
                      {STATUS_PONTO[p.status]}
                    </span>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                    {p.endereco}
                    {p.referencia ? ` — ${p.referencia}` : ""}
                  </p>

                  {p.status === "aceito" && p.eta_ponto && (
                    <div className="mt-4 grid gap-2 rounded-2xl bg-secondary p-4 text-sm sm:grid-cols-3">
                      <p className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Ordem na busca</span>
                        <strong>{p.ordem ?? "—"}º</strong>
                      </p>
                      <p className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Chegada no seu ponto</span>
                        <strong className="flex items-center gap-1">
                          <Clock className="size-3" /> {horaLocal(p.eta_ponto)}
                        </strong>
                      </p>
                      <p className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Motorista sai às</span>
                        <strong className="flex items-center gap-1">
                          <Navigation className="size-3" /> {horaLocal(p.saida_motorista)}
                        </strong>
                      </p>
                    </div>
                  )}

                  {p.status === "aceito" && (
                    <AcompanhamentoAoVivo rotaId={p.rota_id} dataViagem={p.data_viagem} />
                  )}

                  {p.status === "contraproposta" && (
                    <div className="mt-4 rounded-2xl bg-primary/10 p-4 text-sm">
                      <p className="font-semibold">O motorista sugeriu outro ponto:</p>
                      <p className="mt-1">{p.contra_endereco}</p>
                      {p.motivo && (
                        <p className="mt-1 text-xs text-muted-foreground">Motivo: {p.motivo}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => responderContra.mutate({ id: p.id, aceitar: true })}
                          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
                        >
                          Aceitar sugestão
                        </button>
                        <button
                          onClick={() => responderContra.mutate({ id: p.id, aceitar: false })}
                          className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                        >
                          Desistir
                        </button>
                      </div>
                    </div>
                  )}

                  {p.status === "recusado" && p.motivo && (
                    <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                      {p.motivo}
                    </p>
                  )}
                </article>
              );
            })}
            {(pontos.data ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Você ainda não combinou nenhum ponto de embarque.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmbarqueProtegido() {
  return (
    <GuardaPerfil perfis={["passageiro"]}>
      <Embarque />
    </GuardaPerfil>
  );
}
