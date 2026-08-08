# Cobertura nacional: todos os estados brasileiros

Hoje a plataforma trabalha apenas com uma lista fixa de 21 localidades do Amapá
(`src/lib/dados.ts`) e a geocodificação força "Amapá, Brasil". O objetivo é abrir a
plataforma para os 26 estados + DF, com rotas também interestaduais.

## O que muda para o usuário

- **Motorista / frotista**: ao cadastrar uma rota, escolhe primeiro o estado (UF) e
  depois o município, com campo de busca. Ponto A e Ponto B podem estar em estados
  diferentes (rota interestadual), e nesse caso a rota é marcada como "interestadual".
- **Passageiro**: o filtro de busca passa a ter seletor de UF de origem e de destino,
  listando somente as cidades que realmente têm rota ativa. Cada rota mostra
  "Cidade/UF → Cidade/UF".
- **Cadastro / conta / frotista**: o campo "Município" passa a ser UF + município da
  mesma lista oficial, no lugar do texto livre.
- **Cálculo de distância e ponto de embarque**: a medição A→B e o georreferenciamento
  do endereço de apanhe passam a usar a UF informada, o que evita confundir cidades
  homônimas (ex.: Amapá/AP e Amapá do Maranhão).
- Rotas e cadastros já existentes continuam funcionando e são marcados como **AP**.

## Como será feito

### Dados de municípios
- Novo módulo `src/lib/ufs.ts` com as 27 unidades federativas (sigla, nome, região).
- Novo módulo `src/lib/municipios.functions.ts` + `src/lib/municipios.server.ts`:
  server function `listarMunicipios({ uf })` que consulta a API pública do IBGE
  (`servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`), com cache
  em memória por UF e fallback para a lista atual do Amapá caso o serviço falhe.
- `src/lib/dados.ts` mantém `localidadesAP` apenas como fallback/semente.

### Banco de dados (migração)
- `rotas`: novas colunas `uf_origem` e `uf_destino` (text, 2 letras), com backfill
  `'AP'` nas rotas existentes e `NOT NULL DEFAULT 'AP'`.
- `driver_routes`: colunas `origin_uf` / `destination_uf` com o mesmo tratamento.
- `profiles` e `frotistas`: coluna `uf` (text, 2 letras, nula permitida), backfill `'AP'`
  onde o município preenchido pertence à lista atual.
- Trigger de validação garantindo UF entre as 27 siglas válidas.
- Sem mudança de RLS: as políticas atuais continuam válidas.

### Front-end
- Novo componente `src/components/SeletorCidade.tsx`: par UF + município com busca,
  carregando a lista via `listarMunicipios`.
- `src/routes/motorista.tsx`: substitui os dois `<select>` de localidades do Amapá pelo
  novo seletor; envia UF no insert da rota e na medição automática de distância.
- `src/routes/passageiro.tsx`: filtro por UF + cidade derivado das rotas ativas; exibição
  "Cidade/UF".
- `src/routes/auth.tsx`, `src/routes/_authenticated/conta.tsx` e
  `src/routes/_authenticated/frotista.tsx`: campo município migrado para o novo seletor.
- `src/routes/_authenticated/admin.tsx`: coluna e filtro passam a mostrar "Município/UF".

### Servidor
- `src/lib/embarque.server.ts`: `geocodificar` e `medirTrecho` recebem UF opcional e
  compõem a consulta como `"<endereço>, <cidade> - <UF>, Brasil"`, em vez do
  "Amapá, Brasil" fixo; mantido o fallback geodésico.
- `src/utils/embarque.functions.ts`, `src/utils/rota.functions.ts` e
  `src/utils/desvio.functions.ts`: validação da UF (2 letras, lista válida) nos inputs.
- `src/lib/reserva.server.ts` e `src/lib/desvio.server.ts`: repassam a UF da rota ao
  geocodificar o ponto de apanhe.

### Textos e documentação
- Ajuste de textos que citam o Amapá como escopo ("intermunicipal do Amapá" →
  "intermunicipal e interestadual no Brasil") na home, no cadastro de rota e nos dois
  prompts master em `docs/`.
