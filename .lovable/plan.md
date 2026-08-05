# Rastreio ao vivo (Starlink) + Proteção contra pane

Duas frentes complementares: acompanhar a viagem em andamento no mapa, em tempo real, aproveitando a conectividade Starlink dos ramais; e oferecer um seguro que, em caso de pane, despacha veículo substituto para os passageiros e leva o veículo avariado à oficina indicada pelo motorista.

Também será criado o prompt-mestre `docs/PROMPT-MASTER-RASTREIO-SEGURO.md`, no mesmo formato do documento de embarque, para orientar quem evoluir o módulo.

## 1. Viagem ao vivo

- O motorista abre a viagem do dia (rota + data + veículo) e toca em **Iniciar viagem**. O app passa a enviar a posição do GPS do celular a cada ~15 s (ou a cada 100 m percorridos), tolerando quedas de sinal com fila local e reenvio.
- Estados da viagem: planejada → em busca dos passageiros → em viagem → concluída (ou interrompida por pane).
- Painel ao vivo com mapa: posição atual, rastro percorrido, pontos de embarque acordados com seus ETAs recalculados, velocidade e horário da última atualização.
- Quem vê o quê: o motorista vê a própria viagem; o passageiro com ponto acordado naquela saída acompanha o veículo e o seu ETA; o administrador vê todas as viagens em curso. Ninguém mais tem acesso.
- Indicador de conectividade: quando a última posição tem mais de 3 minutos, a tela mostra "sinal instável" com o horário do último ponto, em vez de fingir que o veículo parou.
- Ao concluir, a viagem é fechada com distância percorrida, duração real e um registro no livro de auditoria (blockchain interno), mantendo a transparência já existente na plataforma.

## 2. Proteção RotaCerta (seguro de pane)

Cobrança nas duas modalidades escolhidas:

- **Assinatura mensal do motorista** — novo plano no catálogo, cobrado no cartão ou por débito de créditos (Pix), cobrindo todas as saídas enquanto estiver ativo.
- **Proteção avulsa por assento** — quando o motorista não tem plano ativo, o checkout do passageiro soma uma taxa de proteção por assento, vinculada àquela saída.

Cadastro do motorista:

- Lista de **oficinas de confiança** (nome, endereço, telefone, uma marcada como preferida). É para lá que o veículo avariado é encaminhado.

Fluxo do sinistro (pane em rota):

1. O motorista toca em **Reportar pane** dentro da viagem ao vivo. O sistema captura automaticamente o local (GPS), a rota, o veículo, os passageiros embarcados e a oficina preferida.
2. A viagem entra em "interrompida"; todos os passageiros da saída recebem notificação com a situação e o acompanhamento do atendimento.
3. O chamado abre com duas providências paralelas: **veículo substituto** para dar continuidade à viagem e **remoção do veículo** até a oficina indicada.
4. Painel de atendimento (administrador/assistência) despacha o substituto — motorista, placa e ETA — e registra o reboque. Cada passo notifica motorista e passageiros e é gravado na auditoria.
5. Quando o substituto assume, a viagem continua com o novo veículo e o rastreio segue no mesmo mapa. O chamado é encerrado com o veículo entregue na oficina.
6. Sem cobertura ativa, o botão explica a situação e oferece a contratação antes de abrir o chamado.

O acionamento fica isolado atrás de um adaptador: quando houver seguradora parceira com API, basta plugar — o fluxo de telas não muda.

## Detalhes técnicos

**Banco (migração)**

- `viagens`: rota_id, data_viagem, veiculo_id, motorista_id, status, iniciada_em, concluida_em, distancia_percorrida_km, última posição (lat, lng, velocidade, registrado_em). Único por rota + data.
- `viagem_posicoes`: viagem_id, sequência, lat, lng, velocidade, precisão, registrado_em — somente inserção, sem update/delete.
- `coberturas_seguro`: user_id, modalidade (mensal | avulsa), viagem_id (avulsa), price_id, valor, status, vigência, environment.
- `oficinas`: user_id, nome, endereço, telefone, preferida.
- `sinistros`: viagem_id, veiculo_id, motorista_id, cobertura_id, tipo de pane, descrição, lat/lng, status, oficina_id, substituto (motorista, placa, ETA), timestamps de despacho/reboque/conclusão, passageiros afetados.
- RLS: dono (motorista) gerencia; passageiro com ponto acordado na saída tem leitura de `viagens`, `viagem_posicoes` e do andamento do sinistro; admin lê tudo; posições e sinistros imutáveis para o passageiro. GRANTs para `authenticated` e `service_role`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.viagens, public.viagem_posicoes, public.sinistros`.

**Código**

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Domínio | `src/lib/rastreio.ts` | filtro de posições, distância acumulada, ETA recalculado, limiar de sinal (3 min) |
| Domínio | `src/lib/seguro.ts` | modalidades, valor da proteção por assento, máquina de estados do sinistro |
| Servidor | `src/lib/seguro.server.ts` | abertura de sinistro, despacho do substituto, reboque, notificações, bloco de auditoria |
| RPC | `src/utils/viagem.functions.ts`, `src/utils/seguro.functions.ts` | iniciar/encerrar viagem, reportar pane, contratar proteção, despachar |
| UI | `src/components/MapaViagem.tsx` | mapa ao vivo (Maps JS com a chave de browser, carregada só no cliente) |
| UI | `src/routes/_authenticated/viagem.tsx` | painel do motorista: iniciar, transmitir GPS, reportar pane |
| UI | `src/routes/_authenticated/embarque.tsx` | bloco "minha viagem ao vivo" para o passageiro |
| UI | `src/routes/_authenticated/assistencia.tsx` | fila de sinistros e despacho (admin) |
| Catálogo | `src/lib/planos.ts` | plano "Proteção RotaCerta" (mensal/anual) e preço da proteção avulsa |
| Checkout | `src/components/CheckoutCorrida.tsx` | taxa de proteção por assento quando não há plano ativo |
| Nav | `src/components/TopNav.tsx` | links "Viagem ao vivo" e "Assistência" |

**Invariantes**

- Envio de GPS somente com viagem iniciada e consentimento explícito do motorista; encerra ao concluir ou ao sair da tela.
- `viagem_posicoes` é append-only — o histórico do trajeto nunca é reescrito.
- Reportar pane exige cobertura ativa (mensal do motorista ou avulsa da saída).
- Falha do provedor de mapas degrada para lista textual de posições; o rastreio nunca deixa de gravar.
- Toda transição de sinistro gera notificação aos envolvidos e bloco de auditoria.
