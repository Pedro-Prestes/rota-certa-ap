/**
 * Consolidação contábil detalhada (uso exclusivo do administrador master).
 *
 * Reúne, para um período de competência, o extrato de transações com a
 * identificação do cliente pagador, a composição da taxa administrativa,
 * os repasses aos motoristas, as cobranças Pix/carteira e o demonstrativo
 * mês a mês. Todas as regras financeiras reaproveitam as funções puras já
 * existentes (`comporCobranca`, `comporGanhoViagem`).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CONFIG_PADRAO, comporCobranca, type ConfigTaxa } from "./taxas";
import { comporGanhoViagem } from "./carteira-motorista";

const n = (v: unknown) => Number(v ?? 0) || 0;
const arred = (v: number) => Math.round(v * 100) / 100;
const competenciaDe = (iso: string) => (iso ?? "").slice(0, 7);

export interface PeriodoContabil {
  de: string; // YYYY-MM-DD
  ate: string; // YYYY-MM-DD
}

export interface EstornoResumo {
  id: string;
  valor: number;
  integral: boolean;
  devolve_taxa: boolean;
  motivo: string;
  status: string;
  provedor: string | null;
  provedor_ref: string | null;
  created_at: string;
}

export interface LancamentoResumo {
  id: string;
  tipo: string;
  valor: number;
  descricao: string;
  competencia: string;
  created_at: string;
  corrida_id: string | null;
  pagamento_id: string | null;
  detalhamento: Record<string, unknown> | null;
}

export interface TransacaoContabil {
  id: string;
  pago_em: string;
  competencia: string;
  forma: string;
  status: string;
  parcelas: number;
  bandeira: string | null;
  autorizacao: string | null;
  chave_pix: string | null;
  observacoes: string | null;
  clienteId: string;
  clienteNome: string;
  clienteContato: string | null;
  clienteCurto: string;
  corridaId: string | null;
  rota: string;
  dataCorrida: string | null;
  motorista: string;
  veiculo: string | null;
  assentos: number;
  base: number;
  taxaPercentual: number;
  taxaVariavel: number;
  taxaFixa: number;
  taxaAdministrativa: number;
  total: number;
  taxaGateway: number;
  repasseMotorista: number;
  estornado: number;
  liquidoPlataforma: number;
  estornos: EstornoResumo[];
  lancamentos: LancamentoResumo[];
}

export interface RepasseContabil {
  id: string;
  motoristaId: string;
  motoristaNome: string;
  bruto: number;
  taxaRetida: number;
  valor: number;
  taxa: number;
  liquido: number;
  metodo: string;
  modo: string;
  status: string;
  provedor: string | null;
  referencia: string | null;
  solicitado_em: string;
  processado_em: string | null;
}

export interface CobrancaPixContabil {
  id: string;
  criado_em: string;
  clienteNome: string;
  finalidade: string;
  descricao: string;
  valorBase: number;
  taxaAdmin: number;
  valorTotal: number;
  creditos: number;
  status: string;
  provedor: string;
  referencia: string | null;
  environment: string;
}

export interface LinhaCompetencia {
  competencia: string;
  receita: number;
  taxaPlataforma: number;
  taxaGateway: number;
  repasse: number;
  estorno: number;
  custos: number;
  resultado: number;
}

export interface CustoContabil {
  id: string;
  fornecedor: string;
  categoria: string;
  descricao: string;
  valor: number;
  competencia: string;
  recorrente: boolean;
}

export interface ResumoContabil {
  periodo: PeriodoContabil;
  config: ConfigTaxa;
  totais: {
    transacoes: number;
    base: number;
    taxaAdministrativa: number;
    total: number;
    taxaGateway: number;
    repasse: number;
    estornado: number;
    custos: number;
    resultado: number;
    ticketMedio: number;
  };
  porForma: { forma: string; quantidade: number; total: number; taxaAdministrativa: number }[];
  transacoes: TransacaoContabil[];
  repasses: RepasseContabil[];
  cobrancasPix: CobrancaPixContabil[];
  custos: CustoContabil[];
  competencias: LinhaCompetencia[];
}

async function carregarConfig(): Promise<ConfigTaxa> {
  const { data } = await supabaseAdmin
    .from("plataforma_config")
    .select("chave, taxa_percentual, taxa_fixa, repasse_motorista_percentual, descricao")
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConfigTaxa | null) ?? CONFIG_PADRAO;
}

async function nomesDeUsuarios(ids: string[]) {
  const mapa = new Map<string, { nome: string; contato: string | null }>();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return mapa;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, nome_completo, telefone")
    .in("id", unicos);
  for (const p of data ?? []) {
    mapa.set(p.id, { nome: p.nome_completo || "Cliente sem nome", contato: p.telefone ?? null });
  }
  return mapa;
}

export async function resumoContabil(periodo: PeriodoContabil): Promise<ResumoContabil> {
  const inicio = `${periodo.de}T00:00:00.000Z`;
  const fim = `${periodo.ate}T23:59:59.999Z`;
  const cfg = await carregarConfig();

  const doze = new Date(`${periodo.ate}T00:00:00.000Z`);
  doze.setUTCMonth(doze.getUTCMonth() - 11);
  const inicioDoze = `${doze.toISOString().slice(0, 7)}-01`;

  const [pagRes, lancRes, lancDozeRes, custosRes, payoutsRes, pixRes] = await Promise.all([
    supabaseAdmin
      .from("pagamentos")
      .select("*")
      .gte("pago_em", inicio)
      .lte("pago_em", fim)
      .order("pago_em", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("lancamentos_contabeis")
      .select("*")
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .limit(3000),
    supabaseAdmin
      .from("lancamentos_contabeis")
      .select("tipo, valor, competencia")
      .gte("competencia", inicioDoze)
      .limit(5000),
    supabaseAdmin
      .from("custos_terceiros")
      .select("*")
      .order("competencia", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("driver_payouts")
      .select("*")
      .gte("requested_at", inicio)
      .lte("requested_at", fim)
      .order("requested_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("pagamentos_pix")
      .select("*")
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const pagamentos = pagRes.data ?? [];
  const lancamentos = (lancRes.data ?? []) as unknown as LancamentoResumo[];
  const custos = (custosRes.data ?? []) as unknown as CustoContabil[];
  const payouts = payoutsRes.data ?? [];
  const pix = pixRes.data ?? [];

  const corridaIds = [...new Set(pagamentos.map((p) => p.corrida_id).filter(Boolean))] as string[];
  const pagamentoIds = pagamentos.map((p) => p.id);

  const [corridasRes, estornosRes, ganhosRes, perfis] = await Promise.all([
    corridaIds.length
      ? supabaseAdmin
          .from("corridas")
          .select(
            "id, origem, destino, passageiro_nome, motorista_nome, veiculo, data_corrida, assentos",
          )
          .in("id", corridaIds)
      : Promise.resolve({ data: [] as never[] }),
    pagamentoIds.length
      ? supabaseAdmin.from("estornos").select("*").in("pagamento_id", pagamentoIds)
      : Promise.resolve({ data: [] as never[] }),
    supabaseAdmin
      .from("wallet_transactions")
      .select("driver_id, type, amount, created_at")
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .limit(3000),
    nomesDeUsuarios([
      ...pagamentos.map((p) => p.user_id),
      ...payouts.map((p) => p.driver_id),
      ...pix.map((p) => p.user_id),
    ]),
  ]);

  const corridas = new Map((corridasRes.data ?? []).map((c) => [c.id, c]));
  const estornos = (estornosRes.data ?? []) as unknown as (EstornoResumo & {
    pagamento_id: string;
  })[];
  const ganhos = ganhosRes.data ?? [];

  const transacoes: TransacaoContabil[] = pagamentos.map((p) => {
    const c = p.corrida_id ? corridas.get(p.corrida_id) : undefined;
    const comp = comporCobranca(n(p.valor), cfg);
    const taxaGateway = arred((n(p.valor) * n(p.taxa_percentual)) / 100);
    const ganho = comporGanhoViagem(n(p.valor), n(cfg.repasse_motorista_percentual));
    const meus = estornos.filter((e) => e.pagamento_id === p.id);
    const devolvido = arred(
      meus.filter((e) => e.status === "concluido").reduce((a, e) => a + n(e.valor), 0),
    );
    const taxaDevolvida = arred(
      meus
        .filter((e) => e.status === "concluido" && e.devolve_taxa)
        .reduce((a, e) => a + comp.taxaAdministrativa, 0),
    );
    const perfil = perfis.get(p.user_id);
    return {
      id: p.id,
      pago_em: p.pago_em,
      competencia: competenciaDe(p.pago_em),
      forma: p.forma,
      status: p.status,
      parcelas: n(p.parcelas) || 1,
      bandeira: p.bandeira ?? null,
      autorizacao: p.autorizacao ?? null,
      chave_pix: p.chave_pix ?? null,
      observacoes: p.observacoes ?? null,
      clienteId: p.user_id,
      clienteNome: c?.passageiro_nome || perfil?.nome || "Cliente sem nome",
      clienteContato: perfil?.contato ?? null,
      clienteCurto: (p.user_id ?? "").slice(0, 8),
      corridaId: p.corrida_id ?? null,
      rota: c ? `${c.origem || "—"} → ${c.destino || "—"}` : "—",
      dataCorrida: c?.data_corrida ?? null,
      motorista: c?.motorista_nome || "—",
      veiculo: c?.veiculo ?? null,
      assentos: n(c?.assentos),
      base: comp.base,
      taxaPercentual: comp.taxaPercentualAplicada,
      taxaVariavel: comp.taxaVariavel,
      taxaFixa: comp.taxaFixa,
      taxaAdministrativa: comp.taxaAdministrativa,
      total: comp.total,
      taxaGateway,
      repasseMotorista: ganho.liquido,
      estornado: devolvido,
      liquidoPlataforma: arred(comp.taxaAdministrativa - taxaGateway - taxaDevolvida),
      estornos: meus.map(({ pagamento_id: _p, ...e }) => e),
      lancamentos: lancamentos.filter((l) => l.pagamento_id === p.id),
    };
  });

  const validas = transacoes.filter((t) => t.status === "pago");
  const custosNoPeriodo = custos.filter(
    (c) => c.competencia >= periodo.de && c.competencia <= periodo.ate,
  );
  const somaCustos = arred(custosNoPeriodo.reduce((a, c) => a + n(c.valor), 0));
  const totalTaxa = arred(validas.reduce((a, t) => a + t.taxaAdministrativa, 0));
  const totalGateway = arred(validas.reduce((a, t) => a + t.taxaGateway, 0));
  const totalBase = arred(validas.reduce((a, t) => a + t.base, 0));
  const totalCobrado = arred(validas.reduce((a, t) => a + t.total, 0));
  const totalRepasse = arred(validas.reduce((a, t) => a + t.repasseMotorista, 0));
  const totalEstornado = arred(transacoes.reduce((a, t) => a + t.estornado, 0));

  const formas = new Map<string, { quantidade: number; total: number; taxaAdministrativa: number }>();
  for (const t of validas) {
    const atual = formas.get(t.forma) ?? { quantidade: 0, total: 0, taxaAdministrativa: 0 };
    atual.quantidade += 1;
    atual.total = arred(atual.total + t.total);
    atual.taxaAdministrativa = arred(atual.taxaAdministrativa + t.taxaAdministrativa);
    formas.set(t.forma, atual);
  }

  const brutoPorMotorista = new Map<string, number>();
  const taxaPorMotorista = new Map<string, number>();
  for (const g of ganhos) {
    if (g.type === "RIDE_EARNING") {
      brutoPorMotorista.set(g.driver_id, arred(n(brutoPorMotorista.get(g.driver_id)) + n(g.amount)));
    }
    if (g.type === "PLATFORM_FEE") {
      taxaPorMotorista.set(
        g.driver_id,
        arred(n(taxaPorMotorista.get(g.driver_id)) + Math.abs(n(g.amount))),
      );
    }
  }

  const repasses: RepasseContabil[] = payouts.map((p) => ({
    id: p.id,
    motoristaId: p.driver_id,
    motoristaNome: perfis.get(p.driver_id)?.nome ?? (p.driver_id ?? "").slice(0, 8),
    bruto: n(brutoPorMotorista.get(p.driver_id)),
    taxaRetida: n(taxaPorMotorista.get(p.driver_id)),
    valor: n(p.amount),
    taxa: n(p.fee),
    liquido: n(p.net_amount),
    metodo: p.payout_method,
    modo: p.mode,
    status: p.status,
    provedor: p.provider ?? null,
    referencia: p.provider_reference ?? null,
    solicitado_em: p.requested_at,
    processado_em: p.processed_at ?? null,
  }));

  const cobrancasPix: CobrancaPixContabil[] = pix.map((p) => ({
    id: p.id,
    criado_em: p.created_at,
    clienteNome: perfis.get(p.user_id)?.nome ?? (p.user_id ?? "").slice(0, 8),
    finalidade: p.finalidade,
    descricao: p.descricao,
    valorBase: n(p.valor_base),
    taxaAdmin: n(p.taxa_admin),
    valorTotal: n(p.valor_total),
    creditos: n(p.creditos),
    status: p.status,
    provedor: p.provedor,
    referencia: p.provedor_payment_id ?? null,
    environment: p.environment,
  }));

  const meses: string[] = [];
  const cursor = new Date(`${periodo.ate}T00:00:00.000Z`);
  cursor.setUTCDate(1);
  for (let i = 0; i < 12; i += 1) {
    meses.unshift(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  const competencias: LinhaCompetencia[] = meses.map((m) => {
    const linha: LinhaCompetencia = {
      competencia: m,
      receita: 0,
      taxaPlataforma: 0,
      taxaGateway: 0,
      repasse: 0,
      estorno: 0,
      custos: 0,
      resultado: 0,
    };
    for (const l of lancDozeRes.data ?? []) {
      if (competenciaDe(String(l.competencia)) !== m) continue;
      const v = n(l.valor);
      if (l.tipo === "receita_bruta") linha.receita = arred(linha.receita + v);
      if (l.tipo === "taxa_plataforma") linha.taxaPlataforma = arred(linha.taxaPlataforma + v);
      if (l.tipo === "taxa_gateway") linha.taxaGateway = arred(linha.taxaGateway + v);
      if (l.tipo === "repasse_motorista") linha.repasse = arred(linha.repasse + v);
      if (l.tipo === "estorno") linha.estorno = arred(linha.estorno + v);
      if (l.tipo === "custo_terceiro") linha.custos = arred(linha.custos + v);
    }
    const custosMes = arred(
      custos.filter((c) => competenciaDe(c.competencia) === m).reduce((a, c) => a + n(c.valor), 0),
    );
    linha.custos = Math.max(linha.custos, custosMes);
    linha.resultado = arred(
      linha.taxaPlataforma - linha.taxaGateway - linha.custos - linha.estorno,
    );
    return linha;
  });

  return {
    periodo,
    config: cfg,
    totais: {
      transacoes: validas.length,
      base: totalBase,
      taxaAdministrativa: totalTaxa,
      total: totalCobrado,
      taxaGateway: totalGateway,
      repasse: totalRepasse,
      estornado: totalEstornado,
      custos: somaCustos,
      resultado: arred(totalTaxa - totalGateway - somaCustos),
      ticketMedio: validas.length ? arred(totalCobrado / validas.length) : 0,
    },
    porForma: [...formas.entries()].map(([forma, v]) => ({ forma, ...v })),
    transacoes,
    repasses,
    cobrancasPix,
    custos: custosNoPeriodo,
    competencias,
  };
}
