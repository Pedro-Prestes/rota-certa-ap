# Liberação do credenciamento pelo administrador master

Objetivo: permitir que o administrador master ative o credenciamento de um motorista na página "Idoneidade e veículos", liberando as fases 1, 2 e 3 mesmo que estejam irregulares (idoneidade, biometria, CNH ou veículo pendentes/reprovados).

## Como vai funcionar

- Na página "Idoneidade e veículos", quando quem acessa é o master, aparece um novo bloco "Liberação do credenciamento (master)":
  - busca do motorista por e-mail ou nome;
  - escolha das fases a liberar (1, 2 e 3) ou "liberar todas";
  - campo obrigatório de motivo/justificativa;
  - botão para revogar a liberação depois.
- O motorista liberado passa a ver, na trilha de 3 fases, um selo "Liberado pelo master" nas fases dispensadas, e o botão "Cadastrar veículo" fica habilitado.
- Toda liberação e revogação é registrada em blockchain (auditoria), com quem decidiu, quando e o motivo.
- Nada muda para quem não tem liberação: as regras normais das 3 fases continuam valendo.

## Detalhes técnicos

Banco (migração):
- Nova tabela `public.credenciamento_liberacoes`: `user_id`, `fase1`, `fase2`, `fase3` (booleanos), `motivo`, `liberado_por`, `revogado_em`, timestamps + trigger de `updated_at`.
- GRANTs: `SELECT` para `authenticated` (o motorista lê a própria), `ALL` para `service_role`; RLS com leitura própria ou master, e escrita apenas por `public.eh_admin_master(auth.uid())`.
- `public.motorista_fase_liberada(_user_id, _fase)` passa a retornar `true` quando existe liberação ativa (não revogada) para a fase pedida — isso já desbloqueia o trigger `trg_veiculos_fases` que hoje barra o cadastro de veículo.

Servidor:
- `src/lib/credenciamento-liberacao.server.ts`: `buscarMotoristas`, `liberarCredenciamento`, `revogarLiberacao` — todas exigindo `eh_admin_master` e chamando `registrarEvento` do blockchain.
- `src/utils/credenciamento-liberacao.functions.ts`: server functions com `requireSupabaseAuth` e validação de entrada.

Interface:
- Novo componente `src/components/admin/LiberacaoCredenciamento.tsx` renderizado em `src/routes/_authenticated/verificacao.tsx` apenas para o master.
- `src/components/TrilhaCadastroMotorista.tsx`: o hook `useCredenciamentoMotorista` consulta a liberação ativa e considera `fase1Ok`, `fase2Ok` e `veiculoLiberado` como atendidos quando houver liberação, exibindo o selo "Liberado pelo master".
