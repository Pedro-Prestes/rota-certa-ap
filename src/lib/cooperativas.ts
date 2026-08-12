/** Conteúdo compartilhado das páginas institucionais de cooperativas. */

export const BASE_URL = "https://rotacertabrasil.com.br";
export const WHATSAPP = "5596984095871";

export const FAQ_COOPERATIVAS: Array<[string, string]> = [
  ["O piloto realmente não tem mensalidade?", "Sim. Durante 90 dias, a entidade selecionada recebe implantação e acompanhamento sem mensalidade. Não há renovação automática."],
  ["Precisamos cadastrar toda a frota de uma vez?", "Não. A implantação começa com um grupo de 5 a 10 motoristas e cresce somente após o fluxo inicial funcionar."],
  ["O que acontece ao final dos 90 dias?", "A diretoria recebe um relatório dos resultados. A continuidade paga só é proposta depois dessa revisão e depende da aprovação da entidade."],
  ["Como os dados são protegidos?", "O acesso é compartimentado por perfil, com biometria, regras de visibilidade e registros auditáveis. A coleta comercial segue o princípio de dados mínimos."],
  ["A cooperativa perde sua autonomia?", "Não. A entidade mantém suas regras e operação. O RotaCerta organiza a tecnologia, os registros e os fluxos acordados para o piloto."],
];

/** JSON-LD de perguntas frequentes reutilizado nas páginas de cooperativas. */
export function faqJsonLd(perguntas: Array<[string, string]> = FAQ_COOPERATIVAS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map(([name, texto]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text: texto },
    })),
  };
}

export function breadcrumbJsonLd(itens: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${BASE_URL}${path}`,
    })),
  };
}

/** Contexto operacional por região, usado nas páginas por estado. */
export const CONTEXTO_REGIAO: Record<string, string> = {
  Norte: "distâncias longas entre municípios, rodovias com trechos críticos e passageiros que dependem de horário confiável para consultas, faculdade e trabalho",
  Nordeste: "forte fluxo entre o interior e as capitais, com demanda constante de quem precisa chegar no horário e voltar no mesmo dia",
  "Centro-Oeste": "trechos longos entre cidades do agronegócio, onde a previsibilidade de horário vale mais do que o preço mais baixo",
  Sudeste: "grande volume de deslocamento diário entre municípios vizinhos e viagens interestaduais de alta procura",
  Sul: "rotas regionais bem estabelecidas e passageiros exigentes com pontualidade e conforto",
};
