# Ida e volta + desconto promocional do motorista

## O que muda para o passageiro

1. Na busca de rotas, além de escolher a saída, o passageiro marca **"Ida e volta"** (só habilitado quando a rota tem horário de retorno cadastrado — `saida_retorno`).
2. Ao marcar ida e volta, ele escolhe a **data da volta** (igual ou posterior à data da ida) e o cálculo passa a somar os dois trechos: assentos, bagagem e a taxa de desvio do embarque de cada trecho.
3. Desconto padrão de retorno: **5% no trecho de volta** (o veículo já faria o caminho de retorno), configurável pelo motorista junto com o desconto promocional.
4. A reserva de ida e volta gera **duas pré-reservas vinculadas** (mesma "viagem casada"): se o fechamento T-60 cancelar um trecho, o passageiro é avisado e o outro trecho segue válido, com estorno do trecho cancelado.
5. Exclusividade continua com pagamento imediato — inclusive quando for ida e volta (os dois trechos são pagos na hora).

## Desconto promocional do motorista

1. Nova seção **"Desconto promocional"** em "Sou motorista" (e no painel do frotista, por rota):
   - Tabela sugerida de descontos, coerente com a margem do motorista, calculada a partir do preço do assento e do custo estimado (combustível/km já existente no app):

   ```text
   Nível      Desconto   Quando usar                          Preço final (ex.: R$ 100)
   Leve         5%       Encher os últimos assentos              R$ 95,00
   Atrativo    10%       Saída com ocupação média                R$ 90,00
   Forte       15%       Saída com baixa procura                 R$ 85,00
   Agressivo   20%       Última hora / evitar saída vazia        R$ 80,00
   Limite      25%       Máximo permitido (alerta de margem)     R$ 75,00
   ```

   - Cada nível mostra a **margem estimada** e um aviso quando o desconto aproxima o preço do custo operacional.
   - Campos: percentual, validade (início/fim), e se vale para ida, volta ou ambos.
   - O motorista pode ligar/desligar a promoção a qualquer momento; o desconto nunca é aplicado abaixo do custo mínimo.
2. O desconto entra no cálculo em todos os pontos de preço: cartão de rota, prévia da reserva, preço dinâmico do fechamento T-60 e cobrança (créditos ou Pix).

## Aviso chamativo ao passageiro

1. Selo pulsante **"PROMOÇÃO -X%"** no cartão da rota, com preço antigo riscado e o novo destacado.
2. Faixa de destaque no topo da busca quando existem saídas em promoção ("3 saídas com desconto hoje").
3. Ao selecionar uma rota em promoção: alerta visual no painel de reserva com o valor economizado e a validade da oferta ("válido até 18h30").
4. Notificação (toast + registro em `notificacoes`) para quem já tem pré-reserva na saída que entrou em promoção, informando o novo valor.

## Detalhes técnicos

- **Banco**: nova tabela `rota_descontos` (rota_id, percentual, trecho `ida|volta|ambos`, inicio, fim, ativo, criado_por) com GRANTs, RLS de leitura pública para descontos ativos de rotas ativas e escrita apenas pelo dono da rota / frotista / master. Em `pre_reservas` e `corridas`: colunas `trecho` (`ida|volta`), `reserva_par_id` (vínculo do casamento ida/volta) e `desconto_percentual`.
- **Preço**: nova função pura em `src/lib/preco-dinamico.ts` (ou `src/lib/descontos.ts`) que aplica o desconto após o preço dinâmico e antes das taxas; `src/lib/reserva.server.ts` passa a aceitar `trecho`/`idaEVolta` e devolve a composição dos dois trechos. `src/lib/fechamento.server.ts` respeita o desconto vigente no instante do fechamento.
- **Motorista**: tabela de níveis e cálculo de margem em `src/lib/descontos.ts`; server fns em `src/utils/rota.functions.ts` (definir/encerrar desconto), com registro em blockchain como os demais atos.
- **UI**: `src/routes/passageiro.tsx` (toggle ida e volta, data da volta, selo e alerta de promoção), novo componente `src/components/DescontoPromocional.tsx` usado em `src/routes/motorista.tsx` e no painel do frotista, e `src/components/PreReservas.tsx` exibindo o par ida/volta.
- Todos os textos em português do Brasil; horário programado de partida permanece inviolável.
