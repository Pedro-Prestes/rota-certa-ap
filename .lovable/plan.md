# Área contábil detalhada (padrão Uber/99)

Hoje o módulo `/contabil` mostra apenas totais gerais, uma lista simples de pagamentos e uma tabela de lançamentos com o campo de detalhamento em texto cru — sem período, sem identificação de quem pagou e sem a composição das taxas por transação.

## O que passa a existir

**1. Filtro de período (competência)**
Barra no topo com atalhos: mês atual, mês anterior, últimos 90 dias e intervalo personalizado (de/até). Todos os cartões, tabelas e o resultado passam a respeitar esse período.

**2. Extrato de transações detalhado**
Uma tabela única de transações no período, com uma linha por pagamento e colunas:

```text
Data/hora | Cliente (nome + e-mail/ID curto) | Rota (A → B) | Motorista |
Meio (Pix/crédito/débito/espécie) | Valor bruto | Taxa administrativa |
Tarifa do gateway | Repasse ao motorista | Estornado | Líquido plataforma | Status
```

Clicar na linha abre um painel de detalhe da transação com:
- composição completa: base da corrida, taxa administrativa variável (%) + fixa, total cobrado, tarifa do gateway, repasse ao motorista, resultado líquido da plataforma;
- dados do cliente pagador (nome, contato, ID da conta) e do motorista/frotista recebedor;
- referências externas (provedor, ID da cobrança Pix/cartão, autorização);
- histórico de estornos daquele pagamento e ação de estornar (integral/parcial), como já existe hoje;
- lançamentos contábeis vinculados àquela transação.

**3. Demonstrativo por competência**
Tabela mês a mês (DRE simplificada): receita bruta, taxa administrativa arrecadada, tarifas de gateway, repasses aos motoristas, estornos, custos de terceiros e resultado — com variação em relação ao mês anterior.

**4. Repasses e taxas administrativas**
- Bloco de repasses aos motoristas no período: motorista, valor bruto de ganhos, taxa retida pela plataforma, valor pago, meio (Pix/semanal automático/saque instantâneo), status e data.
- Bloco de assinaturas e créditos (Pix/carteira) separando valor base da taxa administrativa, para não misturar com corridas.

**5. Exportação**
Botão de exportar CSV do extrato de transações e do demonstrativo por competência, respeitando o filtro de período (para contabilidade externa).

Tudo em português, responsivo no celular (tabelas com rolagem horizontal e cartões empilhados), e continua restrito ao administrador master.

## Detalhes técnicos

- Nova server function `resumoContabil` em `src/utils/contabil.functions.ts` com `requireSupabaseAuth`, verificando `has_role(admin)` via `context.supabase` antes de qualquer leitura ampliada; só então carrega, no handler, os dados agregados (pagamentos, corridas, lançamentos, estornos, custos, `driver_payouts`/`wallet_transactions`, `pagamentos_pix`) e os nomes dos pagadores a partir de `profiles`. Retorna apenas os campos necessários — sem expor dados sensíveis além de nome, contato e ID curto.
- Cálculos de composição reaproveitam `comporCobranca` (`src/lib/taxas.ts`), `resumoCorrida` (`src/lib/pagamentos.ts`) e `comporGanhoViagem` (`src/lib/carteira-motorista.ts`); nenhuma regra financeira nova é inventada.
- Agregação por competência e filtros de data feitos no servidor, com paginação do extrato (por exemplo 100 linhas por página).
- `src/routes/_authenticated/contabil.tsx` é dividido em componentes menores (`FiltroPeriodo`, `ExtratoTransacoes`, `DetalheTransacao`, `DemonstrativoCompetencia`, `RepassesPeriodo`), mantendo `GuardaPerfil`, o formulário de custos e o de estorno já existentes.
- CSV gerado no cliente a partir dos dados já carregados.
- Sem mudança de esquema no banco: os dados necessários já existem nas tabelas atuais.
