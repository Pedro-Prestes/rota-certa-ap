# Recrutamento de motoristas nos 27 estados

Criar uma página pública de recrutamento por estado, para os 27 de uma vez, mostrando as vagas gratuitas restantes daquele estado e o caminho de cadastro. Objetivo: atrair motoristas em cada UF pela busca no Google e por links compartilháveis em grupos e redes.

## O que o motorista vê

Ao abrir, por exemplo, `/motorista/ap` (Amapá):

1. Título e texto do estado: "Seja motorista RotaCerta no Amapá — transporte intermunicipal e interestadual com hora marcada".
2. Vagas de cortesia daquele estado: quantas das 10 mensalidades gratuitas ainda estão livres, em destaque, com aviso quando o estado já esgotou.
3. Como funciona em 4 etapas: criar conta, biometria facial, cadastrar veículo, publicar a rota (a cortesia é liberada na primeira rota publicada).
4. Benefícios já existentes na plataforma: carteira digital com repasses, embarque acordado, rastreio ao vivo, proteção contra pane, pagamento por Pix, cartão e espécie.
5. Perguntas frequentes do condutor: quanto custa, quando recebo, preciso de CNPJ, e quando o frotista (PJ) é o caminho.
6. Botões de cadastro e de contato pelo WhatsApp com o estado já preenchido na mensagem.
7. Lista dos demais estados no rodapé da página, para navegação entre UFs.

Estados sem rota cadastrada ainda aparecem: a mensagem muda para "seja o primeiro motorista do estado", que é justamente o público que queremos.

## Estrutura das páginas

- Uma rota dinâmica `/motorista/$uf` cobre os 27 estados a partir da lista que já existe no projeto, sem criar 27 arquivos.
- UF inválida devolve página não encontrada.
- A página atual `/motorista` (painel do condutor) continua no mesmo endereço e ganha, na seção pública, os links para os estados.
- Cada página tem título, descrição, canonical e og próprios com o nome do estado, mais dados estruturados de oferta de trabalho/serviço para busca.
- As 27 URLs entram no `sitemap.xml` junto com as páginas já listadas.

## Dados

Nenhuma tabela nova. A contagem de vagas por estado vem da campanha promocional já implementada (`promo_config` + `promo_lancamento`, via `consultarVagasPromo`), que já retorna vagas usadas e restantes por UF. A contagem passa a ser lida também sem login, para a página pública.

## Detalhes técnicos

- Nova rota `src/routes/motorista.$uf.tsx`, com `params.parse` validando a sigla contra `UFS` de `src/lib/ufs.ts` e `notFound()` para valores fora da lista.
- Conteúdo por estado gerado de `UFS` (nome, sigla, região) para evitar texto duplicado entre páginas: o texto varia por estado e por região.
- Vagas restantes: `consultarVagasPromo` (`src/utils/promocao.functions.ts`) já é uma server function sem middleware de autenticação; consumida no `loader` com `ensureQueryData` e exibida com `useSuspenseQuery`.
- Rotas ativas do estado (opcional na primeira versão): leitura pública das rotas ativas por `uf_origem`, apenas para provar movimento na região quando houver.
- `head()` por página com `title`, `description`, `og:title`, `og:description`, `og:url` e `canonical` apontando para a própria URL, além de JSON-LD.
- `src/routes/sitemap[.]xml.ts`: acrescentar as 27 entradas `/motorista/{uf}` geradas de `UFS`.
- Componentes reaproveitados: `TopNav`, `BotaoVoltar`, botão do WhatsApp com mensagem por estado.

## Fora do escopo

- Páginas por município ou por par de cidades.
- Campanhas pagas, e-mail marketing e envio de SMS em massa.
- Mudança nas regras da promoção (segue 10 vagas por UF, 1 mês grátis na primeira rota).
