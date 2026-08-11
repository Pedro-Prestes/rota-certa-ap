# Divulgação e SEO do RotaCerta

Objetivo: fazer o site aparecer no Google e ser compartilhado corretamente em WhatsApp e redes sociais, usando o domínio https://rotacertabrasil.com.br.

## O que está bom hoje
- Cada página pública já tem título, descrição e tags de compartilhamento (og).
- robots.txt libera Google, Bing, Twitter e Facebook.

## O que falta (será feito)

1. **Sitemap** — criar `/sitemap.xml` gerado pelo app, listando as páginas públicas: início, Sou passageiro, Sou motorista, Sou frotista, Área administrativa e Criar conta. Adicionar a linha `Sitemap:` no robots.txt.

2. **Endereço oficial de cada página (canonical + og:url)** — hoje nenhuma página informa ao Google qual é o seu endereço definitivo. Isso será adicionado em todas as páginas públicas, apontando para `rotacertabrasil.com.br`, evitando conteúdo duplicado entre o domínio, o `www` e o endereço `.lovable.app`.

3. **Páginas que não devem aparecer no Google** — marcar como não indexáveis: entrar/criar sessão (`/auth`), redefinir senha e retorno de cobrança. São páginas técnicas que poluem os resultados de busca.

4. **Dados estruturados (JSON-LD)** — na página inicial, marcação de organização e site com nome, logo, e-mails de contato (rotacertabrasil@ e suporte@) e WhatsApp; e uma marcação de perguntas frequentes na home com dúvidas reais (como funciona a hora marcada, embarque acordado, formas de pagamento Pix/cartão/espécie, proteção contra pane). Isso pode render blocos ricos no resultado do Google.

5. **Imagem de compartilhamento** — a imagem atual de preview aponta para um endereço antigo de pré-visualização. Será trocada por uma imagem própria hospedada no domínio, para que links compartilhados mostrem a marca correta.

6. **Ajuste de textos para busca** — refinar títulos e descrições das páginas públicas com os termos que as pessoas realmente pesquisam (ex.: "van intermunicipal com hora marcada", "transporte interestadual com reserva de assento"), mantendo o tom atual.

## Depois de publicar (fora do código)
- Verificar o domínio no Google Search Console e enviar o sitemap — posso conduzir esse processo se você conectar o Search Console.
- Opcional: pesquisa de palavras-chave via Semrush para orientar futuras páginas por estado/rota (ex.: "Macapá x Santana"), que é o caminho de maior crescimento orgânico.

## Detalhes técnicos
- `src/routes/sitemap[.]xml.ts` como server route (não plugin), `BASE_URL = "https://rotacertabrasil.com.br"`, sem `<lastmod>` (não há timestamp confiável por página).
- `links: [{ rel: "canonical", href }]` apenas nas rotas folha; `og:url` via `meta`. Nada de canonical no `__root.tsx`.
- `og:image`/`twitter:image` movidos do `__root.tsx` para as rotas folha, com URL absoluta no domínio.
- `{ name: "robots", content: "noindex, nofollow" }` em `/auth`, `/reset-password`, `/checkout-retorno`.
- JSON-LD via `head().scripts` em `src/routes/index.tsx` (Organization + WebSite + FAQPage).
- Rotas sob `_authenticated` ficam fora do sitemap.
