import type { ClasseVeiculo, Veiculo } from "./logistica";

export interface Localidade {
  nome: string;
  municipio: string;
  tipo: "sede" | "distrito" | "vilarejo";
}

export const localidadesAP: Localidade[] = [
  { nome: "Macapá (sede)", municipio: "Macapá", tipo: "sede" },
  { nome: "Fazendinha", municipio: "Macapá", tipo: "distrito" },
  { nome: "Bailique", municipio: "Macapá", tipo: "distrito" },
  { nome: "Santana (sede)", municipio: "Santana", tipo: "sede" },
  { nome: "Igarapé da Fortaleza", municipio: "Santana", tipo: "distrito" },
  { nome: "Mazagão Novo", municipio: "Mazagão", tipo: "distrito" },
  { nome: "Mazagão Velho", municipio: "Mazagão", tipo: "vilarejo" },
  { nome: "Laranjal do Jari (sede)", municipio: "Laranjal do Jari", tipo: "sede" },
  { nome: "Vitória do Jari (sede)", municipio: "Vitória do Jari", tipo: "sede" },
  { nome: "Porto Grande (sede)", municipio: "Porto Grande", tipo: "sede" },
  { nome: "Ferreira Gomes (sede)", municipio: "Ferreira Gomes", tipo: "sede" },
  { nome: "Cutias do Araguari", municipio: "Cutias", tipo: "sede" },
  { nome: "Tartarugalzinho (sede)", municipio: "Tartarugalzinho", tipo: "sede" },
  { nome: "Amapá (sede)", municipio: "Amapá", tipo: "sede" },
  { nome: "Calçoene (sede)", municipio: "Calçoene", tipo: "sede" },
  { nome: "Lourenço", municipio: "Calçoene", tipo: "vilarejo" },
  { nome: "Oiapoque (sede)", municipio: "Oiapoque", tipo: "sede" },
  { nome: "Vila Velha do Cassiporé", municipio: "Oiapoque", tipo: "vilarejo" },
  { nome: "Serra do Navio (sede)", municipio: "Serra do Navio", tipo: "sede" },
  { nome: "Pedra Branca do Amapari", municipio: "Pedra Branca do Amapari", tipo: "sede" },
  { nome: "Itaubal do Piririm", municipio: "Itaubal", tipo: "sede" },
];

export const frota: Veiculo[] = [
  {
    id: "v1",
    modelo: "Toyota Hilux SW4 (2019)",
    ano: 2019,
    classe: "utilitario_medio",
    assentos: 6,
    volumeBagageiroL: 1100,
    cargaUtilKg: 620,
  },
  {
    id: "v2",
    modelo: "Renault Master Minibus (2021)",
    ano: 2021,
    classe: "passageiro",
    assentos: 15,
    volumeBagageiroL: 900,
    cargaUtilKg: 1200,
  },
  {
    id: "v3",
    modelo: "Chevrolet Spin (2020)",
    ano: 2020,
    classe: "passageiro",
    assentos: 6,
    volumeBagageiroL: 380,
    cargaUtilKg: 420,
  },
  {
    id: "v4",
    modelo: "Iveco Daily Baú (2018)",
    ano: 2018,
    classe: "utilitario_grande",
    assentos: 3,
    volumeBagageiroL: 9000,
    cargaUtilKg: 3500,
  },
];

export interface Viagem {
  id: string;
  motorista: string;
  nota: number;
  veiculoId: string;
  origem: string;
  destino: string;
  partida: string;
  chegada: string;
  distanciaKm: number;
  dificuldadeVia: number;
  travessias: number;
  assentosLivres: number;
  classe: ClasseVeiculo;
  status: "ativa" | "suspensa";
  aviso?: string;
}

export const viagens: Viagem[] = [
  {
    id: "t1",
    motorista: "Raimundo Nonato",
    nota: 4.9,
    veiculoId: "v2",
    origem: "Macapá (sede)",
    destino: "Oiapoque (sede)",
    partida: "05:30",
    chegada: "13:45",
    distanciaKm: 590,
    dificuldadeVia: 0.7,
    travessias: 1,
    assentosLivres: 6,
    classe: "passageiro",
    status: "ativa",
  },
  {
    id: "t2",
    motorista: "Cleide Marques",
    nota: 4.8,
    veiculoId: "v3",
    origem: "Macapá (sede)",
    destino: "Mazagão Velho",
    partida: "06:15",
    chegada: "08:10",
    distanciaKm: 78,
    dificuldadeVia: 0.35,
    travessias: 1,
    assentosLivres: 3,
    classe: "passageiro",
    status: "ativa",
  },
  {
    id: "t3",
    motorista: "Josué Farias",
    nota: 4.7,
    veiculoId: "v1",
    origem: "Santana (sede)",
    destino: "Laranjal do Jari (sede)",
    partida: "07:00",
    chegada: "12:30",
    distanciaKm: 260,
    dificuldadeVia: 0.55,
    travessias: 0,
    assentosLivres: 2,
    classe: "utilitario_medio",
    status: "suspensa",
    aviso: "Veículo em manutenção (embreagem). Retorno previsto para amanhã 07:00.",
  },
  {
    id: "t4",
    motorista: "Antônio Picanço",
    nota: 4.6,
    veiculoId: "v4",
    origem: "Macapá (sede)",
    destino: "Serra do Navio (sede)",
    partida: "05:00",
    chegada: "09:20",
    distanciaKm: 200,
    dificuldadeVia: 0.6,
    travessias: 0,
    assentosLivres: 2,
    classe: "utilitario_grande",
    status: "ativa",
  },
  {
    id: "t5",
    motorista: "Cleide Marques",
    nota: 4.8,
    veiculoId: "v3",
    origem: "Mazagão Velho",
    destino: "Macapá (sede)",
    partida: "16:00",
    chegada: "18:05",
    distanciaKm: 78,
    dificuldadeVia: 0.35,
    travessias: 1,
    assentosLivres: 5,
    classe: "passageiro",
    status: "ativa",
  },
  {
    id: "t6",
    motorista: "Marcos Aleixo",
    nota: 4.5,
    veiculoId: "v1",
    origem: "Porto Grande (sede)",
    destino: "Pedra Branca do Amapari",
    partida: "06:40",
    chegada: "08:15",
    distanciaKm: 95,
    dificuldadeVia: 0.5,
    travessias: 0,
    assentosLivres: 4,
    classe: "utilitario_medio",
    status: "ativa",
  },
];

export const PRECO_COMBUSTIVEL = 6.49;
export const CONSUMO_KM_L = 8.5;
