# Cadastro do motorista mais simples e guiado

## Objetivo
Transformar biometria facial e CNH em uma sequência clara, especialmente no celular, sem reduzir nenhuma validação ou regra de segurança já existente.

## Experiência proposta

### 1. Uma única jornada, com próximo passo evidente
- Reorganizar “Idoneidade e veículos” como um passo a passo: **1. Dados pessoais e biometria → 2. CNH → 3. Veículo**.
- Exibir somente a ação que o motorista precisa realizar agora; etapas futuras permanecem visíveis, mas recolhidas e com explicação simples.
- Mostrar no topo o progresso geral e uma frase objetiva: “Falta concluir a biometria”, “Agora envie sua CNH” ou “Cadastro liberado para veículo”.
- Após concluir a biometria, retornar automaticamente ao credenciamento e destacar a etapa da CNH.

### 2. Biometria assistida
- Criar uma tela de preparação antes de abrir a câmera, com três verificações visuais: rosto descoberto, boa iluminação e câmera na altura dos olhos.
- Iniciar os desafios somente após o motorista tocar em **Começar verificação**.
- Exibir um desafio por vez, com contagem regressiva e confirmação visual de piscada, movimento e foto final.
- Quando houver falha de câmera ou qualidade, explicar a causa em linguagem simples e oferecer **Tentar novamente**, sem obrigar o motorista a sair da tela.
- Remover do fluxo do motorista a escolha entre biometria de passageiro e motorista; o perfil correto será definido pelo contexto.
- Manter selfie privada, prova de vida, avaliação de qualidade e registro de integridade como estão.

### 3. CNH explicada campo a campo
- Apresentar um checklist curto antes do formulário: documento válido, EAR, categoria e datas legíveis.
- Dividir o preenchimento em blocos claros: número/categoria, validade/primeira habilitação e confirmação de EAR.
- Aplicar teclado numérico e formatação ao número da CNH, limitar a 11 dígitos e validar sem exibir erro enquanto o campo ainda está sendo digitado.
- Explicar “EAR” junto à opção e indicar onde essa informação costuma aparecer no documento.
- Preencher o formulário com os dados já salvos para facilitar correções, sem apagar informações após reprovação.
- Desabilitar o envio com uma lista curta e específica do que ainda falta; durante o envio, impedir toque duplo.

### 4. Resultado e recuperação
- Trocar mensagens técnicas por estados orientados à ação: **Aprovado**, **Em análise** ou **Precisa corrigir**.
- Em cada pendência, mostrar o motivo e o botão correspondente: refazer biometria, corrigir CNH ou continuar para veículo.
- Separar o histórico detalhado da tarefa atual, deixando-o recolhido para não competir com o cadastro.
- Preservar liberações concedidas pelo administrador master e identificá-las de forma clara.

## Validação
- Testar a jornada completa em celular e computador: câmera autorizada, câmera negada, biometria aprovada, biometria com baixa qualidade, CNH incompleta, CNH reprovada e retomada de cadastro.
- Confirmar que nenhuma etapa de veículo é liberada sem aprovação normal ou autorização do administrador master.
- Verificar legibilidade, foco do teclado, ausência de sobreposição e mensagens de erro em telas pequenas.

## Detalhes técnicos
- Alterações concentradas nas telas e componentes de biometria e credenciamento do motorista.
- Reutilizar as consultas e funções autenticadas existentes; não alterar tabelas, políticas, critérios de aprovação ou armazenamento.
- Preservar a proteção em três fases e o fluxo administrativo atual.
