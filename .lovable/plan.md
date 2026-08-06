# Validar as assinaturas dos webhooks da Stripe

## Situação atual (verificada no projeto)

- O app recebe webhooks em `/api/public/payments/webhook?env=sandbox|live`
  (arquivo `src/routes/api/public/payments/webhook.ts`).
- A verificação de assinatura (`verifyWebhook` em `src/lib/stripe.server.ts`)
  aceita **apenas** os segredos gerenciados `PAYMENTS_SANDBOX_WEBHOOK_SECRET` e
  `PAYMENTS_LIVE_WEBHOOK_SECRET`.
- O segredo dos dois destinos informados está salvo como `STRIPE_WEBHOOK_SECRET`
  (já existe nos segredos do projeto), que hoje **não é usado por nenhum código**.
- Os dois destinos apontam para `https://api.rotacerta.com/webhooks/stripe`,
  que não é uma rota deste app. Enquanto a URL não for a do app, nenhum evento
  chega aqui — a validação não pode ser comprovada de ponta a ponta.

## O que será feito

1. **Aceitar múltiplos segredos na verificação**
   Alterar `verifyWebhook` para conferir a assinatura contra uma lista de
   segredos candidatos: o gerenciado do ambiente + `STRIPE_WEBHOOK_SECRET`.
   Comparação em tempo constante, tolerância de 5 min mantida, e continua
   rejeitando (400) quando nenhum segredo confere.

2. **Suportar o estilo de conteúdo "Mínimo" (destino `elegant-breeze-thin`)**
   Nesse estilo a Stripe envia apenas o `id` do objeto. O handler passará a
   detectar payload incompleto e buscar o objeto completo na Stripe
   (`createStripeClient(env)`) antes de processar. O estilo "Instantâneo"
   (destino `elegant-breeze-snapshot`) segue pelo caminho atual.

3. **Rota alternativa `/api/public/webhooks/stripe`**
   Criar um handler que reaproveita a mesma lógica, para o caminho
   `/webhooks/stripe` usado nos destinos. Se `env` não vier na query, assume
   `live` quando o segredo live confere e `sandbox` caso contrário.

4. **Diagnóstico de assinatura**
   Log estruturado (sem expor segredos): qual destino/estilo, se a assinatura
   conferiu, qual conjunto de segredos validou e o `type` do evento — para
   confirmar a validação nos logs após o primeiro evento real.

5. **Teste de validação**
   Gerar localmente um evento assinado com cada segredo e conferir que o
   endpoint responde 200 com assinatura válida e 400 com assinatura inválida
   ou timestamp velho.

## Observações importantes

- **URL dos destinos**: para os eventos chegarem ao app, os dois destinos devem
  apontar para
  `https://rota-certa-ap.lovable.app/api/public/payments/webhook?env=live`
  (ou para `/api/public/webhooks/stripe` após o item 3). Se `api.rotacerta.com`
  for um proxy seu que repassa para o app, precisa preservar o corpo bruto e o
  header `stripe-signature`, senão a assinatura sempre falha.
- **Versão da API**: o destino snapshot usa `2026-01-28.clover` e o app usa
  `2026-03-25.dahlia`. Vou tratar as diferenças de campos de período das
  assinaturas com fallback (item 2), mas o ideal é alinhar o destino ao dahlia.
- **233 eventos ouvidos** é muito além do necessário; o handler ignora os não
  tratados e responde 200, então não quebra nada, mas recomendo reduzir a
  assinatura aos eventos de checkout, subscription e invoice.
