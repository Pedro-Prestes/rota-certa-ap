# Tour guiado de acesso (todos os perfis)

Um passo a passo interativo que aparece no app e mostra, com balõezinhos sobre os próprios botões, como cada pessoa chega ao que precisa — de acordo com o perfil dela.

## Como vai funcionar

- No primeiro acesso após entrar, abre um balão de boas-vindas: "Vamos te mostrar onde ficam suas áreas em 5 passos."
- Cada passo destaca um elemento real da tela (menu ☰, botão "Minha conta", cartão de rota, botão de reserva etc.) com um recorte iluminado, texto curto e botões "Próximo", "Voltar" e "Pular tour".
- O roteiro muda conforme o perfil: passageiro, motorista, frotista, colaborador (secundário/gerente/operacional) e administrador master. Visitante sem login recebe uma versão curta apontando "Criar conta" e "Entrar".
- Ao terminar ou pular, o tour não volta a aparecer sozinho. Fica sempre disponível em "Minha conta" e no menu ☰ como "Como usar o RotaCerta", para reabrir quando quiser.
- Se um passo aponta para uma tela diferente, o tour navega até lá e continua de onde parou.
- Totalmente funcional no celular: balões reposicionados, área de toque grande e o passo do menu abre o ☰ automaticamente.

## Roteiros por perfil

- Passageiro: encontrar rotas → informar endereço de embarque e ver o cálculo → reservar assento → pagar (Pix avulso ou créditos) → acompanhar a viagem ao vivo.
- Motorista: biometria/idoneidade → cadastrar rota Ponto A–Ponto B → aceitar propostas de embarque → navegação do embarque → carteira e repasses → promoção de lançamento.
- Frotista (PJ): cadastro CNPJ → veículos (mínimo 6) → vincular motoristas e rotas → painel do frotista dentro de "Sou frotista (PJ)".
- Colaborador: painel do colaborador → o que cada perfil vê → assistência a ocorrências → contábil (secundário/gerente).
- Administrador master: aprovação de colaboradores → estornos → contábil → auditoria em blockchain → promoção.

## Detalhes técnicos

- Novo componente `src/components/TourGuiado.tsx` (overlay com máscara, posicionamento por `getBoundingClientRect`, foco preso no balão, `Esc` para sair) + `src/lib/tour.ts` com os roteiros por perfil (lista de passos: seletor `data-tour`, título, texto, rota).
- Atributos `data-tour="..."` adicionados aos elementos-alvo já existentes (TopNav, cartões de rota, botões de reserva/checkout, painéis) — sem mudar comportamento.
- Estado de conclusão em `localStorage` por perfil (chave `rotacerta:tour:<perfil>:v1`), lido dentro de `useEffect` para não quebrar a hidratação SSR.
- Montagem única no layout raiz (`src/routes/__root.tsx`), usando `useAcesso()` para escolher o roteiro; nada é exibido enquanto o acesso está carregando.
- Reabertura: item "Como usar o RotaCerta" no menu do `TopNav` e botão em `/conta`.
- Sem novas dependências e sem alterações de banco de dados ou de regras de acesso.
