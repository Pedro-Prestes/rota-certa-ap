# Credenciamento amigável com documentos e revisão administrativa

## Objetivo
Simplificar biometria e CNH para motoristas e criar uma alternativa segura por documentos para motoristas e passageiros quando a biometria não for suficiente. O administrador master poderá decidir cada etapa, reiniciar partes do processo ou limpar todo o credenciamento sem excluir a conta da pessoa.

## Jornada de motorista e passageiro

### 1. Passo a passo simples
- Mostrar uma única jornada com progresso e próxima ação evidente: **dados pessoais → biometria → documentos → CNH e veículo**, quando aplicável ao perfil.
- Exibir apenas a etapa atual aberta; etapas futuras ficam resumidas com o motivo do bloqueio.
- Usar mensagens orientadas à ação: **Aprovado**, **Em análise** ou **Precisa corrigir**.
- Manter as regras atuais de idoneidade, CNH, EAR, categoria, veículo e liberações do master.

### 2. Biometria assistida
- Antes da câmera, mostrar preparação curta: rosto descoberto, boa iluminação e câmera na altura dos olhos.
- Iniciar somente após o toque em **Começar verificação** e conduzir um desafio por vez, com progresso e confirmação visual.
- Em falhas de câmera ou qualidade, explicar o motivo e oferecer **Tentar novamente** na própria tela.
- Remover escolhas desnecessárias de perfil; a plataforma identifica se a captura pertence ao passageiro ou motorista.
- Após sucesso, retornar à jornada e avançar para a próxima etapa.

### 3. Alternativa por documentos
- Quando a biometria for insuficiente, estiver em análise ou for recusada, oferecer **Enviar documentos para análise manual**.
- Passageiro: documento oficial com foto, frente e verso, mais uma selfie segurando o documento.
- Motorista: documento oficial com foto, frente e verso, CNH frente e verso e selfie segurando o documento; os dados estruturados da CNH continuam sendo preenchidos no formulário.
- Upload com câmera ou galeria, pré-visualização, substituição antes do envio, formatos e limites claros.
- Arquivos ficam privados; somente o titular e o administrador master podem visualizá-los por link temporário.
- Validar tipo, tamanho e quantidade no navegador e novamente no servidor.

### 4. CNH mais intuitiva
- Mostrar um checklist curto: número válido, categoria, validade e EAR.
- Organizar o formulário em blocos, explicar onde localizar a EAR e usar teclado numérico no número da CNH.
- Limitar e formatar os 11 dígitos, sem mostrar erro antes do motorista terminar de preencher.
- Reabrir dados já salvos para facilitar correções e indicar exatamente o que falta antes de habilitar o envio.

## Central de análise do administrador master
- Criar uma área única com busca e filtros por perfil, etapa e situação.
- Exibir lado a lado dados declarados, biometria, documentos enviados, CNH e histórico de decisões.
- Permitir em cada etapa: **aprovar**, **solicitar correção**, **rejeitar** ou **excluir a etapa**, sempre com justificativa obrigatória.
- Aprovação manual substitui somente a etapa escolhida e libera a continuação coerente do processo.
- Solicitação de correção devolve a etapa ao usuário com instrução objetiva e mantém o histórico.
- Rejeição bloqueia a continuidade até nova decisão do master ou reinício autorizado.

## Reinício parcial ou total
- O administrador poderá escolher o ponto de reinício: biometria, documentos, CNH ou veículo.
- O reinício remove a validade operacional da etapa escolhida e das etapas seguintes, sem alterar etapas anteriores já aprovadas.
- O usuário recebe a próxima ação e continua exatamente do ponto definido.
- **Exclusão total** significa excluir apenas o credenciamento: a conta e o acesso permanecem, mas biometria, documentos, CNH, veículo e liberações relacionadas deixam de valer e o processo volta ao início.
- Dados de corridas, pagamentos e auditoria não serão apagados; registros necessários permanecem preservados para integridade contábil e legal.
- Ações destrutivas exigem confirmação explícita, justificativa e resumo do impacto antes da execução.

## Auditoria e segurança
- Toda aprovação, correção, rejeição, exclusão e reinício registra administrador, data, motivo, etapa afetada e estado anterior/novo na cadeia de auditoria.
- Criar armazenamento privado e registro próprio para documentos, com acesso do titular e do master.
- Autorizações administrativas serão verificadas no servidor; nenhuma decisão privilegiada ficará disponível diretamente no navegador.
- A interface distinguirá claramente “aprovação automática”, “aprovação manual pelo master” e “pendência documental”.

## Validação
- Testar em celular e computador: câmera permitida/negada, biometria aprovada/insuficiente, envio e substituição de documentos, CNH incompleta/reprovada e retomada do cadastro.
- Testar decisões administrativas por etapa, reinício desde cada ponto e exclusão total somente do credenciamento.
- Confirmar que passageiro e motorista veem apenas os próprios documentos e que nenhum perfil não autorizado acessa decisões ou arquivos.
- Confirmar que veículo e operação continuam bloqueados até aprovação normal ou decisão explícita do master.

## Detalhes técnicos
- A base atual possui verificações de biometria, idoneidade, CNH e liberações por fase, mas não possui registro específico para os documentos alternativos nem histórico completo de decisões e reinícios.
- Será adicionada estrutura para documentos privados, decisões administrativas e estado atual por etapa, com permissões restritas ao titular e ao master.
- As funções administrativas serão autenticadas, validarão o papel master no servidor e aceitarão somente ações, motivos e pontos de reinício previstos.
- As telas existentes de biometria, credenciamento e administração serão reorganizadas para reutilizar as regras atuais e incorporar o novo fluxo.
