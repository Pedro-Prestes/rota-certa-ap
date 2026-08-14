# Credenciamento em 3 fases para Cooperativas e Frotistas

Hoje só o motorista individual tem trilha obrigatória (idoneidade + biometria → CNH → veículo). As tabelas `cooperativas` e `frotistas` guardam apenas identificação e status, sem fases nem validação documental. A proposta replica o funil para pessoa jurídica, com um diferencial próprio de cada perfil.

## Trilha PJ em 3 fases (comum aos dois perfis)

```text
Fase 1  Empresa            CNPJ ativo, razão social, sócio/responsável legal
        (idoneidade PJ)    + biometria facial do responsável legal
Fase 2  Conformidade       Cooperativa: ato constitutivo, registro/alvará, conta no CNPJ
                           Frotista: alvará, seguro de responsabilidade civil (RCF-V/APP)
Fase 3  Frota e condutores Veículo só é aceito com CRLV do exercício vigente
                           e cada motorista vinculado com fases 1 e 2 individuais aprovadas
```

Regra dura: sem fase 1 e 2 aprovadas, a PJ não cadastra veículo nem vincula motorista; sem CNH válida/EAR do motorista, ele não recebe corrida — bloqueio no banco, não só na tela.

## Diferenciais por perfil (padrão Uber Fleet / 99 Frotas / cooperativas de táxi)

Cooperativa
- Selo "Cooperativa verificada" na busca do passageiro e nas páginas /cooperativas/{uf} (prova social — o que mais converte cooperativa de táxi).
- Rateio 7%/3% liberado apenas com trilha 100% aprovada; enquanto pendente, os 3% ficam retidos na carteira e só são repassados após aprovação.
- Painel de conformidade da base: semáforo por motorista (CNH vencendo em 30 dias, biometria pendente, CRLV vencido) com alerta automático.
- Escala de plantão: cooperativa pode priorizar seus motoristas ativos no despacho urbano dentro do município de registro.

Frotista
- Mantém o mínimo de 6 veículos, agora contando só veículos com fase 3 aprovada.
- Nível de frota (Bronze/Prata/Ouro) por conformidade + nota média dos condutores; nível maior dá prioridade no despacho e destaque na vitrine de rotas.
- Vínculo condutor–veículo com trava: motorista sem categoria compatível (D para mais de 8 assentos) não pode ser escalado naquele veículo.
- Painel de custos por veículo e por motorista, com bloqueio automático do veículo quando o CRLV ou o seguro expira.

Ambos
- Score de conformidade (0–100) visível no painel e no admin master, recalculado a cada documento aprovado/vencido.
- Renovação anual automática: documento vencendo gera pendência e, no vencimento, suspende a operação da PJ até a regularização.

## Detalhes técnicos

1. Migração: tabela `pj_conformidade` (tipo_entidade cooperativa|frotista, entidade_id, tipo_documento, numero, validade, status, pendencias) com GRANTs, RLS por dono + admin, e trigger de `updated_at`. Colunas `fase_atual`, `score_conformidade` e `biometria_responsavel` nas tabelas `cooperativas` e `frotistas`.
2. Função `public.pj_fase_liberada(entidade_id, fase)` (security definer) e trigger em `veiculos` e `cooperativa_motoristas` bloqueando inserção quando a PJ não concluiu as fases anteriores.
3. Regras puras em `src/lib/credenciamento-pj.ts`: validade de documentos, cálculo do score, nível de frota, checagem de compatibilidade condutor–veículo.
4. Servidor: `src/lib/credenciamento-pj.server.ts` + `src/utils/credenciamento-pj.functions.ts` para envio/avaliação de documentos, com registro em blockchain como já ocorre na habilitação do motorista.
5. Retenção dos 3%: em `cooperativa.server.ts`, marcar o lançamento como retido quando a trilha não está aprovada e liberar no repasse após aprovação.
6. UI: componente `TrilhaCredenciamentoPJ.tsx` (mesmo visual da trilha do motorista) inserido em `/cooperativa` e `/frotista`, painel de semáforo dos motoristas/veículos, selo e nível na busca do passageiro e nas páginas públicas.
7. Cron diário reaproveitado para varrer vencimentos e disparar avisos multicanal.
