# Lançamento promocional: 1 mês grátis para os 10 primeiros motoristas de cada estado

Os 10 primeiros motoristas que publicarem uma rota em cada estado brasileiro ganham
1 mês do plano Motorista Pro sem custo. São 27 filas independentes (uma por UF), com
10 vagas cada, definidas pela UF de origem da primeira rota publicada.

## Como funciona para o motorista

1. O motorista cadastra sua primeira rota (ex.: Macapá/AP → Santana/AP).
2. No momento em que a rota é salva, o sistema verifica se ainda há vaga promocional na
   UF de origem.
3. Se houver, o plano Motorista Pro é ativado na hora por 30 dias, sem debitar créditos,
   e ele recebe uma notificação com a data de término.
4. Ao fim dos 30 dias o plano encerra sem cobrança automática. O motorista é avisado
   alguns dias antes e pode assinar normalmente (créditos ou cartão) para continuar.
5. Cada motorista ganha o benefício uma única vez, mesmo que publique rotas em vários
   estados. Quem já tem plano ativo não consome vaga.

## Onde a promoção aparece

- **Página inicial**: faixa promocional com o número de vagas restantes por região/estado.
- **Tela "Sou Motorista"**: aviso antes do cadastro da rota ("Restam X vagas gratuitas em AP")
  e confirmação após a publicação, quando o prêmio é concedido.
- **Página de Planos**: selo indicando que o plano atual é promocional e a data de término.
- **Área administrativa**: painel com vagas usadas/restantes por UF e lista de premiados.

## Detalhes técnicos

**Banco de dados (migração)**

- Nova tabela `promo_lancamento` com: `uf`, `user_id`, `rota_id`, `assinatura_id`,
  `posicao` (1..10), `status`, `concedida_em`, `expira_em`, timestamps.
  - índice único `(uf, posicao)` e único em `user_id` (um benefício por motorista).
  - GRANT para `authenticated` (SELECT do próprio registro) e `service_role`;
    RLS: motorista vê o próprio registro, colaboradores/gestão veem todos, escrita
    somente pelo servidor.
- Nova tabela `promo_config` (ou linha em `plataforma_config`) com `vagas_por_uf` (10),
  `price_id` (`motorista_pro_mensal`), `dias` (30), `ativa` e janela de vigência,
  para o admin encerrar/estender o lançamento sem alteração de código.
- Coluna `promocional boolean not null default false` em `assinaturas_carteira`,
  para distinguir o período gratuito na contabilidade e no rótulo da UI.
- View/função `promo_vagas_restantes()` (SECURITY DEFINER, contagem por UF) exposta
  a leitura pública para exibir vagas restantes sem vazar dados de usuários.

**Servidor**

- `src/lib/promocao.server.ts`:
  - `vagasRestantes()` → mapa UF → vagas.
  - `concederPromoPrimeiraRota({ userId, rotaId, uf, environment })`: valida elegibilidade
    (perfil motorista, sem plano ativo, sem benefício anterior, UF válida, promoção ativa),
    reserva a posição via insert com `ON CONFLICT DO NOTHING` (evita corrida entre
    cadastros simultâneos) e cria a assinatura promocional.
  - Ativação da assinatura: registro em `assinaturas_carteira` com `promocional = true`,
    `valor_mensal` do plano, `status = 'ativa'`, `periodo_fim = agora + 30 dias`,
    `cancelar_no_fim = true` (sem débito automático ao fim) — sem passar pelo débito
    de créditos.
  - Lançamento contábil de cortesia (`tipo: 'ajuste'`, detalhamento `origem: 'promo_lancamento'`)
    e evento no hash chain (`promo_lancamento_concedida`) via `registrarEvento`.
- `src/utils/promocao.functions.ts`: server fns `consultarVagasPromo` (pública) e
  `resgatarPromoDaRota` (autenticada), mais leitura do painel admin.
- Chamada da concessão logo após o insert da rota nos fluxos de motorista e frotista
  (frotista usa o `user_id` do motorista responsável, mantendo o limite de 1 por pessoa).
- Aviso de fim do período gratuito: incluir na rotina diária já existente
  (`/api/public/assinaturas/renovar` → `renovarAssinaturasCarteira`) a notificação
  3 dias antes de `periodo_fim` para assinaturas com `promocional = true` e o
  encerramento no vencimento.

**Frontend**

- `src/routes/index.tsx`: bloco promocional com vagas restantes (consulta pública).
- `src/routes/motorista.tsx`: aviso de vagas na UF selecionada e toast de prêmio concedido.
- `src/routes/_authenticated/planos.tsx`: selo "Cortesia de lançamento — válido até dd/mm".
- `src/routes/_authenticated/admin.tsx`: tabela de vagas por UF e premiados, com botão
  para ativar/desativar a promoção.

**Regras de borda**

- Rota excluída depois do prêmio: benefício mantido, vaga não retorna.
- Motorista sem UF válida na rota: não concede.
- Promoção desativada ou vagas esgotadas: cadastro segue normal, sem mensagem de erro.
