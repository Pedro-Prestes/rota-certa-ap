# Modo urbano + rateio de taxa com cooperativas

Dois blocos independentes que se encaixam no mesmo motor de cobrança: corridas urbanas com chave de conversão para o motorista, e partição automática da taxa administrativa quando o motorista pertence a uma cooperativa cadastrada.

## Plano 1 — Modo urbano (padrão 99/Uber)

**Chave de conversão do motorista**
Novo seletor no painel "Sou Motorista": *Intermunicipal/Interestadual* (atual) e *Urbano*. Ao ligar o modo urbano o motorista escolhe o município-base (IBGE) e a plataforma libera automaticamente distritos e vilarejos daquele município e da região metropolitana — sem cadastro de rota.

**Como funciona a corrida urbana**
- Passageiro informa origem e destino no município habilitado e vê o preço estimado antes de pedir.
- Dois modos: **pedido imediato** (motoristas urbanos online próximos recebem a oferta e o primeiro a aceitar leva) e **agendado** (o passageiro marca dia/hora e o motorista confirma antes).
- Painel do motorista com botão *Ficar online/offline*, fila de ofertas com contagem de tempo para aceitar, e etapas: a caminho → aguardando → em viagem → concluída.
- Trajeto transmitido ao vivo (reaproveita o rastreio já existente) e registro do percurso na cadeia de blocos como nas viagens intermunicipais.
- Cancelamento com regra e taxa de cancelamento após o motorista já estar a caminho.
- Ao final, avaliação simples de 1 a 5 estrelas para motorista e passageiro.

**Preço dinâmico por km + minuto**
```text
Preço = Bandeirada + (R$/km × km) + (R$/min × minutos) ,
        respeitando o mínimo por corrida, e multiplicado
        pelo fator de pico quando a demanda/horário exigir
```
Tabela de tarifas urbanas configurável pelo administrador por município (bandeirada, valor por km, valor por minuto, mínimo, faixas e fator de pico). A estimativa de km/minutos vem do mesmo mecanismo de rotas já usado no cálculo de desvio; ajuste final pelo trajeto realmente percorrido.

**Pagamento**: Pix avulso, cartão e espécie, exatamente como hoje, com a taxa administrativa somada de forma demonstrada.

## Plano 2 — Taxa de 10% particionada com a cooperativa

**Cadastro da cooperativa**
A cooperativa passa a ser uma entidade cadastrada (CNPJ, razão social, responsável, UF/município) com **dados de recebimento obrigatórios**: banco, agência, conta e/ou chave Pix, com o documento do titular conferido contra o CNPJ. Motoristas são vinculados à cooperativa; o vínculo é o que ativa o rateio.

**Regra do rateio**
```text
Corrida de motorista cooperado → taxa administrativa de 10%
   7% → Rota Certa Brasil
   3% → cooperativa vinculada
Motorista sem cooperativa → 10% integrais para a plataforma
```
Os percentuais ficam configuráveis (padrão 7/3) e valem tanto para corridas urbanas quanto intermunicipais.

**No instante do pagamento**
No mesmo momento em que o pagamento do passageiro é confirmado, o sistema lança os 3% na carteira da cooperativa e gera o registro contábil do rateio — o valor já aparece como recebido pela entidade. O dinheiro é enviado automaticamente por Pix para a conta cadastrada (repasse imediato quando acima do mínimo, mais rotina automática de fechamento). A arquitetura já fica preparada para ativar o **split real no gateway** (o provedor divide na origem) assim que o Mercado Pago/Stripe aprovar a operação de marketplace — sem mudar as telas nem os relatórios.

**Painel da cooperativa**
Área própria com corridas dos cooperados, valor dos 3% por corrida, saldo, histórico de repasses e comprovantes.

## Processos contábeis e relatórios

- Cada corrida gera lançamentos separados: receita bruta, taxa administrativa, parcela da plataforma (7%), parcela da cooperativa (3%), tarifa do gateway, repasse ao motorista e estornos.
- A área contábil ganha as colunas de rateio no extrato de transações, um bloco *Rateio com cooperativas* (por entidade e por competência) e o modo urbano identificado nas transações.
- Relatórios materializados em arquivo por competência e por período, nos formatos **PDF** (demonstrativo assinado para arquivo), **CSV**, **XLSX** (planilha para o contador) e **XML** estruturado: extrato de transações, demonstrativo por competência, repasses a motoristas e repasses a cooperativas.

## Detalhes técnicos

- Banco: coluna `modalidade` (`intermunicipal`/`urbano`) e `municipio_base` no cadastro do motorista; tabela `tarifas_urbanas` por município; tabelas `corridas_urbanas` (ou reuso de `corridas` + `viagens` com flag urbana) e `ofertas_corrida` para o despacho; tabela `cooperativas` com dados bancários, `cooperativa_motoristas` para vínculo, `cooperativa_wallet` e `cooperativa_transacoes` espelhando o modelo de `driver_wallet`/`wallet_transactions`; `rateio_percentual_cooperativa` em `plataforma_config`. Todas com GRANT + RLS por perfil (motorista vê o seu, cooperativa vê os cooperados, master vê tudo).
- Cobrança: estender `comporCobranca` em `src/lib/taxas.ts` para devolver `parcelaPlataforma` e `parcelaCooperativa`; `src/lib/cobranca.server.ts` e o confirmador de pagamento (webhooks Stripe/Mercado Pago) passam a gravar os dois lançamentos e a creditar a carteira da cooperativa de forma idempotente por pagamento.
- Repasse: novo `src/lib/cooperativa.server.ts` reutilizando o padrão de `carteira-motorista.server.ts` (validação de conta, saque, rotina automática) e a rota de cron existente; ponto único de troca para split nativo do gateway quando habilitado.
- Urbano: `src/lib/urbano.ts` (tarifação determinística, compartilhada cliente/servidor), `src/lib/urbano.server.ts` (despacho, aceite, ciclo de vida) e server functions em `src/utils/urbano.functions.ts`; distância/tempo pelo mesmo provedor de rotas usado em `desvio.server.ts`; realtime do Supabase para as ofertas.
- Contábil: `src/lib/contabil.server.ts` agrega o rateio; exportadores em `src/lib/contabil-export.ts` (CSV/XML no cliente, XLSX via `xlsxwriter`-equivalente JS e PDF gerado no servidor) com os arquivos disponibilizados para download na área contábil.
- Tudo em português do Brasil, responsivo no celular, com o horário de partida programado permanecendo inviolável nas rotas intermunicipais.
