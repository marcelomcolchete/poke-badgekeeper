// Veredito do FIM DE JOGO: traduz as estrelas (0–5 contínuas) em SELO + FALA, separando o
// GINÁSIO (seu emprego: defesas/batalhas) da CIDADE (sua popularidade: missões). Módulo puro,
// sem React — testável isoladamente. "Perfeito" (bucket 5) só com 5,0 cravado (piso).

import { STARS_MAX } from '../engine/constants.ts'

/** Selos por bucket 0–5 (índice = bucket). */
export const BADGE_LABELS = [
  'Horrível',
  'Muito ruim',
  'Ruim',
  'Bom',
  'Muito bom',
  'Perfeito',
] as const

/** Cor de cada selo (índice = bucket): vermelho-escuro → ouro. */
export const BADGE_COLORS = [
  '#8a2020', // 0 Horrível
  '#b14a39', // 1 Muito ruim
  '#c77d3a', // 2 Ruim
  '#5aa84a', // 3 Bom
  '#4aa3d8', // 4 Muito bom
  '#f5b324', // 5 Perfeito
] as const

/** Falas do LÍDER do ginásio (seu chefe avaliando seu trabalho), por bucket 0–5. */
export const GYM_SPEECHES = [
  'Você deixou o ginásio à mercê de qualquer um. Não sei como ainda está de pé aqui.',
  'Quase toda invasão passou por você. Um líder não pode falhar assim.',
  'Segurou o básico, mas perdeu batalhas que não podia perder. Treine mais.',
  'Defendeu o ginásio com competência. É o que se espera de quem ocupa o posto.',
  'Impressionante! Poucos chegaram perto de te derrotar. O ginásio está em boas mãos.',
  'Nenhuma derrota, nenhuma falha. Defendeu este ginásio como um mestre — tenho orgulho de você.',
] as const

/** Falas da Enfermeira Joy (em nome do povo) sobre sua POPULARIDADE, por bucket 0–5. */
export const CITY_SPEECHES = [
  'As pessoas mal sabem quem você é... e quem sabe, prefere esquecer. Ninguém recebeu sua ajuda.',
  'O povo anda decepcionado. Pediram socorro tantas vezes e você quase não apareceu.',
  'Algumas pessoas foram ajudadas, mas a cidade esperava bem mais de você.',
  'Os moradores gostam de te ter por perto. Você ajudou bastante gente por aí.',
  'A cidade inteira comenta seus feitos! Você virou alguém em quem todos confiam.',
  'Você é o herói da cidade! Cada pedido foi atendido — todos te adoram e jamais vão te esquecer.',
] as const

/** Foto da Joy (representa o povo) — fixa. */
export const NURSE_JOY_SPRITE = '/sprites/trainers/nurse.png'

/** Persona exibida na coluna do ginásio (foto + nome). */
export interface GymLeader {
  name: string
  sprite: string
}

/** Líder por cidade (só Pewter/Cerulean jogáveis hoje); demais usam o fallback genérico. */
const GYM_LEADERS: Record<number, GymLeader> = {
  0: { name: 'Brock', sprite: '/sprites/trainers/gen3/brock-gen3.png' },
  1: { name: 'Misty', sprite: '/sprites/trainers/gen3/misty-gen3.png' },
}

const FALLBACK_LEADER: GymLeader = {
  name: 'Líder do Ginásio',
  sprite: '/sprites/trainers/gen3/brock-gen3.png',
}

/** Líder do ginásio da cidade (fallback para cidades ainda não jogáveis). */
export function gymLeaderFor(cityIndex: number): GymLeader {
  return GYM_LEADERS[cityIndex] ?? FALLBACK_LEADER
}

/**
 * Bucket 0–5 das estrelas (0–5 contínuas). FLOOR: "Perfeito" (5) só com 5,0 cravado;
 * abaixo de 1 → "Horrível" (0). Fora da faixa é fixado em [0, STARS_MAX].
 */
export function starBucket(stars: number): number {
  const clamped = Math.max(0, Math.min(STARS_MAX, stars))
  return Math.floor(clamped)
}
