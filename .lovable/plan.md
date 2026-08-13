# Preço dinâmico com fechamento da saída 60 minutos antes

Hoje o passageiro reserva e paga na hora, com preço fixo por assento. A mudança transforma a reserva em duas etapas: **pré-reserva** (sem pagamento) e **fechamento da saída 60 minutos antes do horário programado**, quando a plataforma calcula o valor real conforme a ocupação e o desvio da rota de busca, avisa os passageiros e confirma um por um mediante pagamento.

## Como passa a funcionar

1. **Pré-reserva** — o passageiro escolhe a saída, os assentos e o endereço de embarque. Nada é cobrado; ele vê uma faixa estimada de preço ("de X a Y, conforme a ocupação") e a hora em que o valor final será enviado.
2. **Fechamento (T-60 min)** — a plataforma fecha a saída, monta a rota de busca otimizada com todos os endereços pré-reservados, mede km e minutos extras e calcula o valor final por assento.
3. **Fila de confirmação** — o aviso vai para o passageiro com mais assentos primeiro. Ele tem **5 minutos** para aceitar e pagar (créditos da carteira ou Pix avulso).
4. **Sem pagamento no prazo** — a pré-reserva é liberada, a rota de busca e o preço são recalculados sem aquele ponto e o próximo passageiro da fila recebe o novo valor. Isso segue até a última pré-reserva.
5. **Cancelamento** — se ao fim da fila nenhum pagamento foi confirmado, a saída é cancelada por inviabilidade e todos (passageiros e motorista) são avisados.
6. **Horário de saída preservado** — o cálculo continua usando a retropropagação atual: o horário de partida anunciado não muda; o que se ajusta é o horário em que o motorista inicia a busca.

## Preço escalonado por ocupação

Fator multiplicador aplicado sobre o preço de assento publicado, conforme a taxa de ocupação confirmada da saída:

```text
ocupação >= 80%  -> 1.00x
60% a 79%        -> 1.15x
40% a 59%        -> 1.35x
20% a 39%        -> 1.60x
abaixo de 20%    -> 1.90x (nunca acima da tarifa exclusiva do veículo)
```

Ao valor do assento soma-se a parcela do desvio de embarque do próprio passageiro (km e minutos extras da sua parada) e, por fim, a taxa administrativa já existente. Teto absoluto: o passageiro nunca paga mais que a tarifa de exclusividade do veículo.

## Avisos por todos os canais

Cada oferta de valor dispara, em paralelo: notificação no app, e-mail, SMS e mensagem de WhatsApp com o valor, o prazo de 5 minutos e o link direto para pagar. O motorista recebe o resumo do fechamento (assentos confirmados, receita, rota de busca) e o aviso de cancelamento quando ocorrer.

## Detalhes técnicos

**Banco (migração)**
- Nova tabela `pre_reservas`: rota, data da viagem, passageiro, assentos, assentos de bagagem, endereço/coordenadas do embarque, `exclusiva`, `bagagem_kg`, status (`pendente`, `ofertada`, `confirmada`, `expirada`, `cancelada`), `valor_ofertado`, `oferta_expira_em`, `prioridade`. GRANTs + RLS (passageiro gere as próprias; motorista/frotista da rota lê; master lê tudo).
- Nova tabela `fechamentos_saida`: rota, data, `fechada_em`, ocupação, fator aplicado, km/min de desvio total, receita confirmada, status (`em_fila`, `confirmada`, `cancelada`). GRANTs + RLS.
- `rotas`: nenhuma alteração estrutural; o estado do fechamento vive em `fechamentos_saida`.
- Agendamento `pg_cron` de minuto a minuto chamando o novo endpoint de fechamento.

**Servidor**
- `src/lib/preco-dinamico.ts` — tabela de fatores por ocupação, teto pela tarifa exclusiva, funções puras testáveis.
- `src/lib/fechamento.server.ts` — seleciona saídas na janela T-60, monta a rota de busca com `src/lib/embarque.ts` + `desvio.server.ts`, calcula os valores, cria/avança a fila, expira ofertas vencidas, recalcula após cada expiração, cancela a saída sem confirmação e grava evento no blockchain interno.
- `src/lib/avisos.server.ts` — disparo multicanal (notificacoes, e-mail, SMS via `sms.server`, WhatsApp) reaproveitado pelos avisos de oferta, confirmação e cancelamento.
- `src/routes/api/public/rotas/fechamento.ts` — endpoint protegido por `x-cron-secret`, no mesmo padrão de `assinaturas/renovar`.
- `src/utils/pre-reserva.functions.ts` — server functions autenticadas: criar/cancelar pré-reserva, listar minhas pré-reservas, aceitar e pagar a oferta (créditos ou Pix avulso reaproveitando `reserva.server.ts`).
- `reserva.server.ts` passa a aceitar o valor fechado da oferta em vez de recalcular a tarifa base, mantendo taxa administrativa, lançamentos contábeis e repasses como estão.

**Interface**
- `src/routes/passageiro.tsx`: o cartão de Reserva vira "Pré-reservar", com faixa de preço estimada, hora do fechamento e explicação do processo. Nova seção "Minhas pré-reservas" com contagem regressiva de 5 minutos e botões Aceitar/Pagar quando a oferta chega.
- `src/components/EmbarquesMotorista.tsx` / `motorista.tsx`: painel do fechamento da saída (fila, confirmados, receita, status).
- Exclusividade continua funcionando como hoje (tarifa integral, franquia de 40 kg), fora da fila de rateio.
