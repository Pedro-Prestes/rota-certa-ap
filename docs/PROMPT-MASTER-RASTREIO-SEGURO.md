# RotaCerta — Rastreio da viagem e Proteção contra pane

Documento de referência da metodologia adotada para o acompanhamento do trajeto
em atividade e para a assistência 24h em caso de pane.

## 1. Rastreio por satélite (Starlink)

O aparelho do motorista transmite a posição durante toda a viagem.

- Envio a cada **15 s** ou a cada **100 m** percorridos — o que ocorrer primeiro.
- Pontos com precisão pior que **120 m** são descartados (ruído de GPS).
- O trajeto é *append-only*: cada ponto entra em `viagem_posicoes` com uma
  `sequencia` crescente; nada é sobrescrito.
- Se a última posição tem mais de **3 minutos**, a tela mostra
  **“sinal instável”** com o horário do último ponto conhecido — a plataforma
  nunca finge que o veículo parou.

Estados da viagem: `planejada → em_busca → em_viagem → concluida`, com
`interrompida` quando há pane. Ao encerrar, a distância é consolidada a partir
das posições reais e o resultado entra no livro de auditoria (blockchain
interno) como evento `viagem_concluida`.

Quem vê o quê:

| Ator | Acesso |
| --- | --- |
| Motorista | sua viagem, transmissão e chamados |
| Passageiro | apenas as saídas em que tem ponto de embarque **aceito** |
| Administração | todas as viagens e chamados |

## 2. Proteção RotaCerta

Duas modalidades de cobertura:

- **Mensal (motorista)** — R$ 39,90, vale 30 dias e cobre todas as saídas do
  período. Renovação automática por débito de créditos na rotina diária.
- **Avulsa por assento** — R$ 4,90 por assento, vinculada a uma saída
  específica (rota + data).

Pagamento por Pix e cartões de todas as bandeiras (checkout embutido) ou por
débito dos créditos da carteira, mantendo a regra de que Pix recorrente é
substituído por débito mensal de créditos.

A cobertura ativa é o que **autoriza a abertura do chamado de pane**.

## 3. Atendimento da pane

Duas providências paralelas, registradas passo a passo:

```text
aberto
  ├─► substituto_despachado ─► passageiros_realocados ─┐
  └─► reboque_acionado ─► veiculo_na_oficina ──────────┴─► concluido
```

- **Continuidade da viagem**: veículo substituto com motorista, placa e tempo
  estimado de chegada; os passageiros afetados recebem notificação.
- **Veículo avariado**: reboque até a **oficina indicada pelo motorista**
  (lista de oficinas de confiança, a primeira é a preferida).
- **Contabilidade**: o custo do atendimento entra em `lancamentos_contabeis`
  como custo de terceiros, com detalhamento do chamado.
- **Auditoria**: cada transição gera bloco no livro de auditoria.

## 4. Superfícies

| Rota | Uso |
| --- | --- |
| `/viagem` | motorista: transmissão, pontos, cobertura, registrar pane, oficinas |
| `/embarque` | passageiro: acompanhamento ao vivo do seu ponto aceito |
| `/assistencia` | administração: atendimento dos chamados |

## 5. Rotina diária

A chamada agendada em `pg_cron` para `/api/public/assinaturas/renovar` renova,
no mesmo passo, as assinaturas pagas com créditos e as coberturas mensais de
proteção.
