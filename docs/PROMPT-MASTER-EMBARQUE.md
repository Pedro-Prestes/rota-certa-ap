# PROMPT MASTER — Metodologia de Embarque Acordado (RotaCerta)

> Prompt de referência para engenheiros/agentes que evoluírem este módulo.

## Contexto do problema real

O transporte intermunicipal do Amapá é operado de forma desestruturada: o motorista
normalmente já conhece os passageiros e é cultural combinarem informalmente um ponto
de apanhe. Isso gera atrasos imprevisíveis e destrói a promessa de **hora de saída
garantida**, que é o diferencial da plataforma.

## Diretriz de produto

Formalizar o acordo cultural sem perder o horário: o passageiro **propõe** o ponto,
o motorista **aceita** ou envia **contraproposta**; com os pontos acordados, a
plataforma traça a **rota de busca otimizada por georreferenciamento** e devolve,
para todos os atores, o horário em que o motorista sai da base, o ETA de cada ponto
e o custo adicional do percurso de apanhe.

## Modelo matemático (implementado em `src/lib/embarque.ts`)

Caminho aberto: `base do motorista → p1 → … → pn → saída da cidade`.

1. Matriz de tempos/distâncias: malha viária real (Google Routes) com fallback
   geodésico (Haversine × fator viário 1,28 a 27 km/h).
2. Otimização: vizinho mais próximo + refinamento 2-opt (ou
   `optimizeWaypointOrder` do provedor quando disponível).
3. Retropropagação a partir da partida programada:

```text
t_saida_motorista = t_partida − (Σ trechos + n·τ_parada + folga)
eta(p_k)          = t_saida_motorista + Σ_{i≤k} trecho_i + (k−1)·τ_parada
```

com `τ_parada = 3 min` (embarque + bagagem) e `folga = 10 min`.

4. Custo da busca: `C = D · (P_comb / K_consumo + 0,62)`.

## Contratos técnicos

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Domínio puro | `src/lib/embarque.ts` | Haversine, matriz, 2-opt, ETAs, custo |
| Servidor | `src/lib/embarque.server.ts` | Geocodificação, Routes API via gateway, persistência do plano |
| RPC | `src/utils/embarque.functions.ts` | `localizarEndereco`, `planejarEmbarque` (autenticadas) |
| UI passageiro | `src/routes/_authenticated/embarque.tsx` | Proposta, acordo, ETA do próprio ponto |
| UI motorista | `src/components/EmbarquesMotorista.tsx` | Aceite/contraproposta e plano de busca |

Dados: `pontos_embarque` (acordo, coordenadas, ordem, ETA) e `planos_embarque`
(km, duração, custo, saída do motorista, sequência), ambos com RLS por dono da
rota e por passageiro.

## Invariantes a preservar em qualquer evolução

1. Somente pontos com status `aceito` entram no plano — proposta não altera horário.
2. O horário de partida programado nunca é deslocado; o ajuste ocorre no horário de
   saída do motorista.
3. Toda chamada ao Google passa pelo gateway de conectores, nunca com chave direta.
4. Falha do provedor externo degrada para o modo geodésico, nunca quebra o fluxo.
5. Recalcular o plano é idempotente (upsert por `rota_id + data_viagem`).
