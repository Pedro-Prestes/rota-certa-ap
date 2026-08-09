/**
 * Roteiros do tour guiado de acesso, por perfil.
 * Cada passo pode destacar um elemento real da tela (`alvo`, via [data-tour])
 * e/ou levar o usuário até uma rota antes de exibir o balão.
 */
import { PERFIS_COLABORADOR, temAcesso, type Perfil } from "@/lib/acessos";

export interface PassoTour {
  id: string;
  titulo: string;
  texto: string;
  /** Seletor CSS do elemento destacado. Sem alvo, o balão aparece centralizado. */
  alvo?: string;
  /** Rota exibida ao chegar neste passo. */
  rota?: string;
  /** Abre o menu lateral (☰) antes de destacar o alvo. */
  abrirMenu?: boolean;
}

export interface Roteiro {
  chave: string;
  titulo: string;
  passos: PassoTour[];
}

const PASSO_MENU: PassoTour = {
  id: "menu",
  titulo: "Todas as suas áreas ficam aqui",
  texto:
    "Toque no botão ☰ para ver a lista completa de áreas liberadas para o seu perfil, no computador e no celular.",
  alvo: '[data-tour="menu"]',
  abrirMenu: true,
};

const PASSO_CONTA: PassoTour = {
  id: "conta",
  titulo: "Minha conta",
  texto:
    "Aqui você confere seus perfis, idoneidade, biometria, planos e pagamentos — e pode reabrir este tour quando quiser.",
  alvo: '[data-tour="conta"]',
  rota: "/conta",
};

const VISITANTE: Roteiro = {
  chave: "visitante",
  titulo: "Como começar",
  passos: [
    {
      id: "boas-vindas",
      titulo: "Bem-vindo ao RotaCerta",
      texto:
        "Transporte intermunicipal e interestadual com hora marcada. Em 3 passos mostramos como entrar e usar a plataforma.",
      rota: "/",
    },
    {
      id: "criar-conta",
      titulo: "Crie sua conta",
      texto:
        "Cadastre-se como passageiro, motorista ou frotista (PJ) por e-mail ou por código no celular. Depois é só concluir a biometria facial.",
      alvo: '[data-tour="criar-conta"]',
    },
    {
      id: "entrar",
      titulo: "Já tem conta?",
      texto: "Use “Entrar” para acessar suas áreas. O tour recomeça de acordo com o seu perfil.",
      alvo: '[data-tour="entrar"]',
    },
    PASSO_MENU,
  ],
};

const PASSAGEIRO: Roteiro = {
  chave: "passageiro",
  titulo: "Tour do passageiro",
  passos: [
    {
      id: "inicio",
      titulo: "Vamos te mostrar suas áreas",
      texto: "São poucos passos: encontrar rota, calcular o embarque, reservar, pagar e acompanhar.",
      rota: "/passageiro",
    },
    {
      id: "rotas",
      titulo: "Encontre a sua rota",
      texto:
        "Escolha estado e cidade de origem e destino. Aparecem apenas os horários futuros — embarques já passados saem da lista automaticamente.",
      alvo: '[data-tour="busca-rotas"]',
      rota: "/passageiro",
    },
    {
      id: "reserva",
      titulo: "Informe onde você embarca",
      texto:
        "Ao reservar, digite seu endereço: o sistema calcula o desvio (km e minutos extras), a taxa e o total antes de enviar a proposta ao motorista.",
      alvo: '[data-tour="reserva"]',
      rota: "/passageiro",
    },
    {
      id: "embarque",
      titulo: "Embarque acordado",
      texto:
        "Em “Embarque” você acompanha o ponto de apanhe combinado, o horário e o valor detalhado da sua corrida.",
      rota: "/embarque",
    },
    {
      id: "pagamento",
      titulo: "Pague como preferir",
      texto:
        "Pix avulso pelo valor da corrida, cartões de todas as bandeiras ou créditos da carteira. Assinaturas ficam em “Planos”.",
      rota: "/planos",
    },
    PASSO_CONTA,
    PASSO_MENU,
  ],
};

const MOTORISTA: Roteiro = {
  chave: "motorista",
  titulo: "Tour do motorista",
  passos: [
    {
      id: "inicio",
      titulo: "Bem-vindo, motorista",
      texto:
        "Vamos mostrar o caminho: liberar sua conta, publicar rota, receber passageiros e receber o dinheiro.",
      rota: "/motorista",
    },
    {
      id: "biometria",
      titulo: "Primeiro, libere sua conta",
      texto:
        "Biometria facial e consulta de idoneidade sua e do veículo. Sem isso, as rotas não ficam visíveis aos passageiros.",
      rota: "/biometria",
    },
    {
      id: "rota",
      titulo: "Publique sua rota",
      texto:
        "Cadastre Ponto A e Ponto B, horários e assentos. A distância e o tempo são calculados automaticamente.",
      alvo: '[data-tour="cadastro-rota"]',
      rota: "/motorista",
    },
    {
      id: "propostas",
      titulo: "Aceite as propostas de embarque",
      texto:
        "Cada pedido mostra o desvio, o tempo extra e o valor. Ao aceitar, o ponto de apanhe entra na sua rota de busca.",
      alvo: '[data-tour="propostas"]',
      rota: "/motorista",
    },
    {
      id: "viagem",
      titulo: "Navegue e acompanhe ao vivo",
      texto:
        "Em “Viagem ao vivo” o GPS conduz você até cada passageiro pelo nome, com tempo de espera e rastreio do trajeto.",
      rota: "/viagem",
    },
    {
      id: "carteira",
      titulo: "Sua carteira e repasses",
      texto:
        "Acompanhe ganhos, taxas e saques. Os repasses são liquidados automaticamente na conta bancária cadastrada.",
      rota: "/carteira",
    },
    {
      id: "promo",
      titulo: "Promoção de lançamento",
      texto:
        "Os 10 primeiros motoristas de cada estado ganham 1 mês de Motorista Pro ao publicar a primeira rota — sem cobrança automática.",
      rota: "/planos",
    },
    PASSO_MENU,
  ],
};

const FROTISTA: Roteiro = {
  chave: "frotista",
  titulo: "Tour do frotista (PJ)",
  passos: [
    {
      id: "inicio",
      titulo: "Bem-vindo, frotista",
      texto: "Sua operação PJ em 4 passos: cadastro, veículos, motoristas e painel.",
      rota: "/sou-frotista",
    },
    {
      id: "cadastro",
      titulo: "Cadastro exclusivo PJ",
      texto: "O acesso de frotista é vinculado ao CNPJ da empresa e à sua idoneidade.",
      rota: "/sou-frotista",
    },
    {
      id: "veiculos",
      titulo: "Mínimo de 6 veículos",
      texto:
        "A ativação do perfil frotista acontece quando a frota chega a 6 veículos regulares cadastrados.",
      rota: "/frotista",
    },
    {
      id: "motoristas",
      titulo: "Motoristas e rotas",
      texto:
        "Vincule motoristas aos veículos e às rotas, controle manutenção e indisponibilidade sem cancelar a rota recorrente.",
      rota: "/frotista",
    },
    {
      id: "financeiro",
      titulo: "Recebimentos",
      texto: "Carteira, taxas e repasses da frota ficam em “Carteira”.",
      rota: "/carteira",
    },
    PASSO_MENU,
  ],
};

const COLABORADOR: Roteiro = {
  chave: "colaborador",
  titulo: "Tour do colaborador",
  passos: [
    {
      id: "inicio",
      titulo: "Área administrativa",
      texto:
        "Seu acesso foi concedido pelo administrador master e mostra apenas o que o seu perfil permite.",
      rota: "/area-administrativa",
    },
    {
      id: "painel",
      titulo: "Painel do colaborador",
      texto: "Ponto de partida do dia: rotas, viagens, embarques e ocorrências em andamento.",
      rota: "/colaborador",
    },
    {
      id: "assistencia",
      titulo: "Assistência a ocorrências",
      texto:
        "Panes: veículo substituto, remanejamento de passageiros e reboque até a oficina indicada pelo motorista.",
      rota: "/assistencia",
    },
    {
      id: "contabil",
      titulo: "Visão contábil (gestão)",
      texto:
        "Administrador secundário e gerente acompanham receita, taxas, custos de terceiros e lançamentos por competência.",
      rota: "/contabil",
    },
    PASSO_MENU,
  ],
};

const ADMIN: Roteiro = {
  chave: "admin",
  titulo: "Tour do administrador master",
  passos: [
    {
      id: "inicio",
      titulo: "Você tem acesso total",
      texto: "Cinco paradas: colaboradores, estornos, contabilidade, auditoria e promoção.",
      rota: "/area-administrativa",
    },
    {
      id: "colaboradores",
      titulo: "Aprovação de colaboradores",
      texto:
        "Somente você aprova ou recusa acessos administrativos e concede perfis a cada conta.",
      rota: "/admin",
    },
    {
      id: "estornos",
      titulo: "Estornos integrais e parciais",
      texto: "Devolva valores à origem do pagamento — Pix, cartão ou créditos — com registro contábil.",
      rota: "/pagamentos",
    },
    {
      id: "contabil",
      titulo: "Contabilidade demonstrada",
      texto:
        "Receita bruta, taxa da plataforma, gateway, repasses e serviços de terceiros, detalhados por competência.",
      rota: "/contabil",
    },
    {
      id: "auditoria",
      titulo: "Auditoria em blockchain",
      texto: "Cadeia de blocos com os eventos da operação e o trajeto percorrido, verificável ponta a ponta.",
      rota: "/auditoria",
    },
    {
      id: "promo",
      titulo: "Promoção por estado",
      texto: "Acompanhe as 10 vagas de cortesia por UF e os motoristas premiados.",
      rota: "/admin",
    },
    PASSO_MENU,
  ],
};

/** Escolhe o roteiro conforme o perfil (mais específico primeiro). */
export function roteiroPara(logado: boolean, perfis: Perfil[]): Roteiro {
  if (!logado) return VISITANTE;
  if (perfis.includes("admin")) return ADMIN;
  if (temAcesso(perfis, PERFIS_COLABORADOR)) return COLABORADOR;
  if (perfis.includes("frotista")) return FROTISTA;
  if (perfis.includes("motorista")) return MOTORISTA;
  return PASSAGEIRO;
}

export const EVENTO_ABRIR_TOUR = "rotacerta:abrir-tour";

/** Reabre o tour de qualquer lugar do app. */
export function abrirTour() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_TOUR));
}

export function chaveTour(chave: string) {
  return `rotacerta:tour:${chave}:v1`;
}
