# Deixar o SEO operante para conquistar cooperativas de táxi

O básico técnico já existe (títulos, descrições, og, canonical, sitemap com 27 páginas de motorista, robots.txt, JSON-LD de Service em `/cooperativas`). O que falta é o que realmente traz cooperativa: Google reconhecendo o site e páginas com a busca que um dirigente de cooperativa faz.

## 1. Ligar o Google Search Console (bloqueio principal)
Sem isso o Google não recebe o sitemap e não há como medir nada.
- Conectar a conta Google via cartão de conexão no chat.
- Verificar a propriedade `https://rotacertabrasil.com.br/` por meta tag no `<head>` da raiz.
- Enviar `https://rotacertabrasil.com.br/sitemap.xml`.
- Publicar uma vez para a tag ficar no ar antes da verificação.

## 2. Páginas de cooperativa por estado
Hoje existe uma única página `/cooperativas`. Dirigentes pesquisam com o estado/cidade ("cooperativa de táxi em Belém", "aplicativo para cooperativa de táxi no Pará"). Criar `/cooperativas/{uf}` para as 27 UFs, cada uma com:
- Título e descrição próprios com o nome do estado.
- Contexto real do estado (rotas intermunicipais típicas, capital e interior).
- Vagas do piloto de 90 dias e mesmo formulário de diagnóstico, marcando a UF de origem.
- JSON-LD `Service` com `areaServed` = estado.
- Entrada no sitemap e link cruzado com `/cooperativas`.

## 3. Reforçar a página `/cooperativas`
- Adicionar `FAQPage` JSON-LD com as 5 perguntas que já estão na página (pode render bloco expandido no Google).
- Adicionar `BreadcrumbList`.
- Bloco "Perguntas de diretoria" e link para as páginas por estado.

## 4. Descoberta interna
- Link para "Cooperativas" na home (hoje só aparece no menu) e no rodapé, com âncora textual que o Google entende.
- Link recíproco entre `/cooperativas` e `/sou-frotista`.

## 5. Confiança institucional
- JSON-LD `Organization` na home com e-mails oficiais e WhatsApp (verificar se já está completo).
- Página de contato/institucional com CNPJ, e-mails e telefone — ajuda o dirigente a confiar e ajuda o Google a entender a entidade.

## 6. Pesquisa de palavras-chave antes de escrever
Rodar pesquisa (Semrush) para termos de cooperativa/associação de taxistas e transporte de passageiros por estado, e usar os termos com demanda real nos títulos das páginas do item 2 — em vez de adivinhar.

## Detalhes técnicos
- Nova rota `src/routes/cooperativas.$uf.tsx` seguindo o padrão de `seja-motorista.$uf.tsx` (loader valida a UF, `notFound()` se inválida, `head()` com canonical próprio).
- `src/routes/sitemap[.]xml.ts`: acrescentar `...UFS.map(u => ({ path: `/cooperativas/${u.sigla.toLowerCase()}`, changefreq: "weekly", priority: "0.8" }))`.
- Formulário reutilizado de `/cooperativas`, gravando em `public.parcerias_leads` com `origem: "pagina_cooperativas_uf"` e `uf` pré-selecionada.
- Meta tag de verificação do GSC vai no `head()` do `src/routes/__root.tsx`.
- Sem `<lastmod>` no sitemap (não há timestamp confiável por página).

## Fora do código
Depois de publicar: enviar o sitemap, acompanhar cobertura no Search Console e responder aos primeiros diagnósticos recebidos pelo painel de parcerias. SEO leva de 4 a 12 semanas para indexar e ranquear as páginas por estado — vale combinar com contato direto (WhatsApp/e-mail) às cooperativas nesse período.
