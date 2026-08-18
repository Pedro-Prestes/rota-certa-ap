# Normatizar o RotaCerta para Google Play e App Store

Objetivo: deixar a plataforma aprovável nas duas lojas. Hoje faltam as páginas legais obrigatórias, o fluxo de exclusão de conta, as declarações de permissões, o projeto iOS e o pacote de conteúdo exigido nos formulários das lojas.

## 1. Páginas legais e de conformidade (web + app)

Novas rotas públicas, indexáveis e linkadas no rodapé e no menu:

- `/privacidade` — Política de Privacidade em PT-BR: dados coletados (cadastro, telefone, biometria facial, localização em tempo real, pagamentos), finalidade, base legal LGPD, tempo de retenção, compartilhamento (pagamentos, mapas, notificações), direitos do titular e contato do encarregado (suporte@rotacertabrasil.com.br).
- `/termos` — Termos de Uso: papéis (passageiro, motorista, frotista, cooperativa), taxa administrativa 10% (7%/3% com cooperativa), regras de reserva, exclusividade, T-60, reembolsos e estornos, condutas proibidas.
- `/excluir-conta` — página pública (exigência do Google Play) explicando como pedir exclusão + botão autenticado que dispara a solicitação, com prazo e informação sobre o que é apagado e o que é retido por obrigação fiscal.
- `/seguranca-e-dados` — resumo da política de segurança de dados e de uso de biometria/localização, em linguagem simples.

Também: link de exclusão de conta e privacidade dentro de "Minha conta", e aviso de consentimento explícito antes da captura facial e antes de ativar rastreio ao vivo.

## 2. Exclusão de conta funcional

- Tabela `solicitacoes_exclusao` (usuário, motivo, status, datas) com RLS: o usuário vê/cria apenas a própria; o master vê todas.
- Função de servidor autenticada que registra a solicitação, marca a conta como em exclusão e bloqueia novas reservas.
- Painel do master para concluir a exclusão (anonimização dos dados pessoais preservando lançamentos contábeis obrigatórios).

## 3. Android (Google Play)

- Declarar no `AndroidManifest.xml` apenas as permissões realmente usadas: internet, localização em primeiro plano (e foreground service de localização somente para o motorista em viagem), câmera para biometria, notificações.
- Adicionar `android:usesCleartextTraffic="false"`, backup rules e `targetSdk` já em 36 (ok).
- Ajustar o Capacitor para deixar de ser apenas um wrapper de URL remota: manter o carregamento do site publicado, mas adicionar tela de splash nativa, tratamento offline e navegação nativa de voltar, além de plugins de câmera/geolocalização/notificação para que o app tenha funções de dispositivo (critério que evita reprovação por "conteúdo apenas web").
- Preencher o Data Safety com base na Política de Privacidade; incluir a declaração de "Uso de localização em segundo plano" com vídeo demonstrativo do rastreio da viagem.
- Corrigir `public/.well-known/assetlinks.json` com o SHA-256 real do keystore de release (depende de você enviar a impressão digital).

## 4. iOS (App Store)

- Adicionar `@capacitor/ios` e gerar o projeto `ios/` com bundle id `app.rotacerta.ios`, ícones e launch screen.
- `Info.plist` com as descrições de uso obrigatórias: câmera (biometria), localização em uso e sempre (rastreio da viagem), notificações, e `ITSAppUsesNonExemptEncryption=false`.
- Guideline 4.2 (mínimo de funcionalidade): garantir splash nativa, permissões nativas, notificações push e mapa nativo, não apenas o site embarcado.
- Guideline 3.1.1: as compras da plataforma são serviços de transporte no mundo real (Pix/cartão), portanto ficam fora do In-App Purchase; incluir texto de justificativa nas notas de revisão. Os planos de assinatura de motorista serão apresentados como serviço B2B fora do app iOS para evitar exigência de IAP.
- Guideline 5.1.1(v): exclusão de conta dentro do app — atendida pelo item 2.
- Login com Apple obrigatório porque existe login Google: adicionar provedor Apple na autenticação e botão na tela de acesso (depende das suas credenciais de desenvolvedor Apple).

## 5. Pacote de submissão

Documento em `docs/LOJAS-SUBMISSAO.md` com: descrição curta e longa, palavras-chave, classificação de conteúdo, questionários de privacidade preenchidos, URLs de suporte/privacidade/exclusão, notas para o revisor (contas de teste), e checklist de capturas de tela nos tamanhos exigidos.

## Detalhes técnicos

- Rotas novas em `src/routes/` com `head()` próprio (título, descrição, og) e inclusão em `src/routes/sitemap[.]xml.ts`.
- Consentimentos gravados em tabela `consentimentos` (tipo, versão, data, IP) para provar a base legal.
- Plugins Capacitor: `@capacitor/geolocation`, `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/splash-screen`, `@capacitor/app`.
- O build iOS exige macOS com Xcode; aqui geramos e configuramos o projeto, e a compilação/envio é feita por você ou por um serviço de CI com macOS.

## O que preciso de você

1. SHA-256 do keystore de release (para o assetlinks e o App Links).
2. Credenciais Apple Developer (Team ID) para o Login com Apple e o bundle id.
3. Confirmar se as assinaturas de motorista podem ficar fora do app iOS (recomendado) ou se quer implementar IAP.

## Fora do escopo

Compilar e enviar os binários às lojas, criar as contas de desenvolvedor e produzir o vídeo de localização em segundo plano.
