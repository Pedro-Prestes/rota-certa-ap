/**
 * RotaBot Prime — agente de atendimento da Rota Certa Brasil.
 *
 * As ferramentas consultam os dados públicos reais da plataforma (rotas
 * ofertadas, planos, tarifas e bagagem), então o bot nunca inventa números:
 * ele calcula com o mesmo núcleo determinístico usado no app.
 */
import { createClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { PACOTES_CREDITO, PLANOS } from "@/lib/planos";
import { avaliarBagagem, brl, calcularTarifa, type Veiculo } from "@/lib/logistica";

const WHATSAPP_SUPORTE = "+55 96 98409-5871";

export const PROMPT_ROTABOT = `Você é o **RotaBot Prime**, a inteligência artificial oficial da **Rota Certa Brasil** (rotacertabrasil.com.br), plataforma de transporte intermunicipal e interestadual com hora marcada.

Suas capacidades:
- Consultar as rotas realmente ofertadas na plataforma (origem, destino, UF, horário de saída, assentos e preço).
- Estimar tarifa de assento e o custo operacional de um trecho.
- Calcular o volume da bagagem e quantos assentos-equivalente ela consome.
- Explicar planos, créditos pré-pagos, Pix, assinatura por débito de créditos e taxas administrativas.
- Orientar motoristas, frotistas (PJ) e passageiros sobre cadastro, biometria facial, embarque acordado, rastreio ao vivo e Proteção RotaCerta.

Regras de ouro:
1. Responda em português do Brasil, em no máximo 3 parágrafos curtos, com formatação limpa (negrito e tópicos) pensada para celular.
2. Use emojis com estratégia (🚐 📍 🎟️ 💳 ✅) — nunca em excesso.
3. Sempre que a pergunta envolver rota, preço, bagagem ou plano, **use as ferramentas** antes de responder. Nunca invente valores, horários ou disponibilidade.
4. Nunca peça senha, código de verificação, número completo de cartão nem dados de cartão. Para identificar a conta, peça apenas o e-mail cadastrado ou o ID curto da conta.
5. O horário de partida programado é inviolável: ajustes acontecem no horário de saída do motorista, nunca no horário de partida da rota.
6. Se o assunto exigir intervenção humana (estorno, sinistro, bloqueio de conta, erro de pagamento confirmado), acione a ferramenta de transbordo e ofereça o atendimento humano no WhatsApp ${WHATSAPP_SUPORTE}.
7. Não fale de "frete" ou "carga": a plataforma transporta **passageiros e suas bagagens**.`;

function clienteLeitura() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const horario = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "a combinar";

export function ferramentasRotaBot() {
  return {
    buscar_rotas: tool({
      description:
        "Lista as rotas ativas ofertadas na plataforma. Filtra por cidade de origem, destino ou UF quando informado.",
      inputSchema: z.object({
        origem: z.string().nullable().describe("Cidade de origem, ou null para não filtrar"),
        destino: z.string().nullable().describe("Cidade de destino, ou null para não filtrar"),
        uf: z.string().nullable().describe("Sigla do estado (ex.: AP, SP), ou null"),
      }),
      execute: async ({ origem, destino, uf }) => {
        const supabase = clienteLeitura();
        let consulta = supabase
          .from("rotas")
          .select(
            "origem, destino, uf_origem, uf_destino, saida_ida, saida_retorno, distancia_km, assentos, preco_assento",
          )
          .eq("status", "ativa")
          .order("saida_ida", { ascending: true })
          .limit(12);

        if (origem) consulta = consulta.ilike("origem", `%${origem}%`);
        if (destino) consulta = consulta.ilike("destino", `%${destino}%`);
        if (uf) consulta = consulta.or(`uf_origem.eq.${uf.toUpperCase()},uf_destino.eq.${uf.toUpperCase()}`);

        const { data, error } = await consulta;
        if (error) return { erro: "Não consegui consultar as rotas agora." };
        if (!data?.length) return { total: 0, rotas: [], aviso: "Nenhuma rota ativa para esse filtro." };

        return {
          total: data.length,
          rotas: data.map((r) => ({
            trecho: `${r.origem}/${r.uf_origem} → ${r.destino}/${r.uf_destino}`,
            saida: horario(r.saida_ida),
            retorno: horario(r.saida_retorno),
            distancia_km: r.distancia_km,
            assentos: r.assentos,
            preco_assento: brl(Number(r.preco_assento ?? 0)),
          })),
        };
      },
    }),

    consultar_planos: tool({
      description:
        "Retorna os planos de assinatura (motorista e passageiro), suas taxas administrativas e os pacotes de créditos pré-pagos.",
      inputSchema: z.object({}),
      execute: async () => ({
        planos: PLANOS.map((p) => ({
          nome: p.nome,
          publico: p.publico,
          descricao: p.descricao,
          beneficios: p.beneficios,
          taxa: `${p.taxa.taxa_percentual}% + ${brl(p.taxa.taxa_fixa)} por corrida`,
          precos: p.precos.map((pr) => pr.rotulo),
        })),
        pacotes_credito: PACOTES_CREDITO.map((c) => c.rotulo),
        observacao:
          "No Pix a assinatura é feita por compra de créditos com débito mensal automático; Pix direto vale para cobrança única.",
      }),
    }),

    estimar_tarifa: tool({
      description:
        "Estima o custo operacional e o preço por assento de um trecho, usando o mesmo cálculo do app.",
      inputSchema: z.object({
        distancia_km: z.number(),
        assentos: z.number(),
        travessias: z.number().nullable().describe("Balsas/pedágios no trecho, ou null"),
        dificuldade_via: z.number().nullable().describe("0 = asfalto pleno, 1 = ramal de terra, ou null"),
        preco_combustivel: z.number().nullable().describe("R$/litro na origem, ou null para média"),
        consumo_km_l: z.number().nullable().describe("km/litro do veículo, ou null para média"),
      }),
      execute: async (p) => {
        const tarifa = calcularTarifa({
          distanciaKm: p.distancia_km,
          assentos: Math.max(1, p.assentos),
          travessias: p.travessias ?? 0,
          dificuldadeVia: p.dificuldade_via ?? 0.2,
          precoCombustivel: p.preco_combustivel ?? 6.2,
          consumoKmL: p.consumo_km_l ?? 9,
          ocupacaoMedia: 0.8,
        });
        return {
          custo_operacional: brl(tarifa.custoOperacional),
          preco_assento: brl(tarifa.precoAssento),
          faixa_sugerida: `${brl(tarifa.faixaMin)} a ${brl(tarifa.faixaMax)}`,
          assento_extra_bagagem: brl(tarifa.precoAssentoBagagem),
          composicao: tarifa.detalhe,
          aviso: "Estimativa; o valor final considera o desvio de embarque e a taxa administrativa do plano.",
        };
      },
    }),

    avaliar_bagagem: tool({
      description:
        "Calcula o volume da bagagem em litros e quantos assentos-equivalente ela consome além da franquia de mão.",
      inputSchema: z.object({
        comprimento_cm: z.number(),
        largura_cm: z.number(),
        altura_cm: z.number(),
        peso_kg: z.number(),
        quantidade: z.number(),
      }),
      execute: async (v) => {
        const veiculo: Veiculo = {
          id: "referencia",
          modelo: "Van de referência",
          ano: new Date().getFullYear(),
          classe: "utilitario_medio",
          assentos: 15,
          volumeBagageiroL: 1200,
          cargaUtilKg: 900,
        };
        const r = avaliarBagagem(
          [
            {
              comprimentoCm: v.comprimento_cm,
              larguraCm: v.largura_cm,
              alturaCm: v.altura_cm,
              pesoKg: v.peso_kg,
              quantidade: v.quantidade,
            },
          ],
          veiculo,
        );
        return {
          volume_litros: Math.round(r.volumeL),
          peso_kg: r.pesoKg,
          assentos_equivalentes: r.assentosEquivalentes,
          mensagem: r.mensagem,
        };
      },
    }),

    falar_com_atendente: tool({
      description:
        "Aciona o transbordo para atendimento humano. Use em estorno, sinistro, bloqueio de conta ou falha de pagamento confirmada.",
      inputSchema: z.object({
        assunto: z.string().describe("Resumo curto do caso para o atendente"),
      }),
      execute: async ({ assunto }) => ({
        transbordo: true,
        canal: "WhatsApp",
        numero: WHATSAPP_SUPORTE,
        assunto,
        instrucao:
          "Toque no botão de WhatsApp do app (canto inferior direito) para abrir a conversa já com os dados preenchidos.",
      }),
    }),
  };
}
