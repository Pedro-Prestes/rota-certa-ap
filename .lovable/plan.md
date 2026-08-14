# Cadastro do motorista em 3 fases obrigatórias

Hoje o motorista consegue cadastrar veículo em `/verificacao` sem que a idoneidade pessoal ou a CNH tenham sido aprovadas — a tabela `veiculos` aceita o insert direto (política `veiculos_dono_total` só checa o dono) e a tela não trava nada. Também não existe hoje nenhum registro de validade/categoria da CNH nem de EAR no banco.

O objetivo é um funil sequencial, no padrão 99/Uber: cada fase só abre quando a anterior for aprovada.

## Fase 1 — Pessoa física + biometria facial
- Aproveita o que já existe: verificação de idoneidade do motorista (CPF, nome, data de nascimento) e biometria facial com prova de vida.
- Fase 1 aprovada = existe verificação de idoneidade do motorista com status "aprovado" **e** biometria facial aprovada.
- Enquanto não aprovada: as fases 2 e 3 aparecem bloqueadas, com o motivo e o botão para concluir a pendência.

## Fase 2 — Habilitação (CNH)
Novo cadastro de CNH com: número, categoria (A, B, C, D, E e combinações), data de validade, data da primeira habilitação e marcação de EAR (Exerce Atividade Remunerada).

Regras de aprovação automática:
- Número da CNH válido nos dígitos verificadores do Denatran (regra já existente no projeto).
- CNH dentro da validade (vencida = reprovada; a vencer em menos de 30 dias = aviso).
- Categoria mínima **B**; motorista com menos de 21 anos reprovado (regra já existente).
- EAR obrigatória para transporte remunerado de passageiros: sem EAR, a fase fica reprovada.
- Categoria D exigida quando o veículo tiver mais de 8 assentos (contando o condutor).

## Fase 3 — Veículo
- O formulário de cadastro de veículo só é liberado com as fases 1 e 2 aprovadas; antes disso a tela mostra o passo pendente em vez do formulário.
- Além das validações que já existem (placa antiga/Mercosul, Renavam, chassi, idade máxima de 10 anos, mínimo de 4 assentos, CRLV vigente e situação regular), entra a compatibilidade CNH × veículo:
  - até 8 assentos: categoria B ou superior;
  - acima de 8 assentos: categoria D;
  - EAR sempre exigida.
- Veículo nasce com verificação pendente e só fica operacional (aparece para vincular a rotas, modo urbano e publicação de rotas) quando a análise do veículo for aprovada.
- Bloqueio também no banco, não só na tela: nenhum veículo pode ser inserido por quem não passou pelas fases 1 e 2.

## Painel de acompanhamento
Em `/verificacao`, uma trilha visual com os 3 passos (concluído / em análise / bloqueado / reprovado com o motivo), mostrando exatamente qual pendência resolver. O administrador master continua podendo revisar e reverter manualmente qualquer fase.

## Detalhes técnicos

**Banco (migração):**
- Nova tabela `public.habilitacoes_motorista`: `user_id`, `numero`, `categoria`, `ear boolean`, `validade date`, `primeira_habilitacao date`, `status status_verificacao`, `pendencias jsonb`, timestamps + trigger de `updated_at`. GRANT para `authenticated` (select/insert/update do próprio registro) e `service_role`; RLS: dono lê/grava o próprio, admin total.
- Função `public.motorista_fase_liberada(_user_id uuid, _fase int)` (SECURITY DEFINER, `search_path = public`) devolvendo se a fase está liberada, consultando idoneidade + biometria + habilitação.
- Trigger `BEFORE INSERT` em `public.veiculos` que levanta exceção quando `motorista_fase_liberada(user_id, 3)` for falso (admin e frotista com fluxo próprio ficam isentos, para não quebrar o cadastro de frota já existente).

**Código:**
- `src/lib/habilitacao.ts`: categorias, validação de validade/EAR e matriz categoria × assentos (puro, testável).
- `src/lib/habilitacao.server.ts` + `src/utils/habilitacao.functions.ts`: server fn autenticada que grava a análise da CNH e registra o evento na cadeia de auditoria, como já é feito na idoneidade e na biometria.
- `src/lib/idoneidade.ts` / `idoneidade.server.ts`: acrescentar a checagem categoria × assentos e EAR na avaliação do veículo.
- `src/routes/_authenticated/verificacao.tsx`: trilha de 3 fases, formulário de CNH e gate do formulário de veículo.
- `src/routes/motorista.tsx`: aba de veículos/rotas exibindo o bloqueio quando as fases não estiverem aprovadas.
