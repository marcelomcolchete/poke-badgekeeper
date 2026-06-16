// Treinadores que invadem o ginásio na defesa (PLAN §4.4).
//
// Cada classe de treinador tem uma ARTE (public/sprites/trainers) e o seu próprio elenco
// de Pokémon. A defesa de um dia sorteia treinadores SEM repetição (um treinador não vem
// duas vezes no mesmo dia — engine/setup). O nível de cada Pokémon do treinador é a Batalha
// da espécie ±10 (E..S), resolvido na engine; aqui ficam só QUAIS espécies cada um traz.
//
// Dois formatos de elenco:
//  - `roster`: sorteia (COM repetição) de uma lista fixa de espécies.
//  - `rival`:  um líder fixo + o resto totalmente aleatório, com no máx. 1 lendário no time.

import type { TrainerId } from '../types/index.ts'
import { evolutionFamily } from './pokemon/index.ts'

export type TrainerPool =
  | { kind: 'roster'; speciesIds: number[] }
  | { kind: 'rival'; lead: number }

export interface TrainerDef {
  id: TrainerId
  /** Nome exibido na seleção e na batalha. */
  displayName: string
  /** Arte canônica em public/sprites/trainers. */
  spritePath: string
  /**
   * Variantes alternativas da arte (ex.: gen3 + gen3rs). Quando presentes, a defesa sorteia
   * uma entre `spritePath` e estas (semeado pelo dia/defesa — estável dentro do mesmo evento).
   */
  altSprites?: string[]
  pool: TrainerPool
}

/** Todas as artes do treinador (canônica + variantes), para o sorteio da defesa. */
export function trainerSprites(t: TrainerDef): string[] {
  return t.altSprites && t.altSprites.length > 0 ? [t.spritePath, ...t.altSprites] : [t.spritePath]
}

/** Junta várias linhas evolutivas + espécies avulsas numa lista de espécies sem repetição. */
function roster(...parts: (number | number[])[]): TrainerPool {
  const ids = new Set<number>()
  for (const part of parts) {
    if (Array.isArray(part)) for (const id of part) ids.add(id)
    else ids.add(part)
  }
  return { kind: 'roster', speciesIds: [...ids].sort((a, b) => a - b) }
}

// Ids de espécie (Gen 1) usados nos elencos — nomeados para legibilidade.
const CHARMANDER = 4
const BULBASAUR = 1
const SQUIRTLE = 7
const PIKACHU = 25
const EEVEE = 133
const RATTATA = 19
const PIDGEY = 16
const PIDGEOTTO = 17
const SPEAROW = 21 // linha do "Fearow"
const FARFETCHD = 83
const DODUO = 84
const NIDORAN_F = 29
const NIDORINA = 30
const JIGGLYPUFF = 39
const CLEFAIRY = 35
const ODDISH = 43
const BELLSPROUT = 69
const MEOWTH = 52
const GEODUDE = 74
const ONIX = 95
const SANDSHREW = 27
const ZUBAT = 41
const RHYHORN = 111
const OMANYTE = 138
const KABUTO = 140
const AERODACTYL = 142
const MACHOP = 66
const MANKEY = 56
// Linhas evolutivas dos treinadores da Equipe Rocket (missão Rocket Team).
const EKANS = 23
const KOFFING = 109
const DROWZEE = 96
const CUBONE = 104
// Espécies dos treinadores de Cerulean (Água/Gelo).
const STARYU = 120
const GOLDEEN = 118
const MAGIKARP = 129
const PSYDUCK = 54
const VAPOREON = 134
const SEEL = 86
const KRABBY = 98
const GLOOM = 44
const TANGELA = 114
const IVYSAUR = 2
const JYNX = 124
const DIGLETT = 50
const EXEGGCUTE = 102
const CLOYSTER = 91 // linha do Shellder
const TENTACOOL = 72
const POLIWAG = 60
const HORSEA = 116

const TRAINER_LIST: TrainerDef[] = [
  {
    id: 'YOUNGSTER',
    displayName: 'Jovem',
    spritePath: '/sprites/trainers/gen3/youngster-gen3.png',
    altSprites: ['/sprites/trainers/gen3/youngster-gen3rs.png'],
    pool: roster(CHARMANDER, BULBASAUR, SQUIRTLE, PIKACHU, EEVEE, RATTATA, PIDGEY, PIDGEOTTO),
  },
  {
    id: 'BIRD_KEEPER',
    displayName: 'Criador de Aves',
    spritePath: '/sprites/trainers/gen3/birdkeeper-gen3.png',
    altSprites: ['/sprites/trainers/gen3/birdkeeper-gen3rs.png'],
    pool: roster(
      evolutionFamily(PIDGEY),
      evolutionFamily(SPEAROW),
      FARFETCHD,
      evolutionFamily(DODUO),
    ),
  },
  {
    id: 'LASS',
    displayName: 'Moça',
    spritePath: '/sprites/trainers/gen3/lass-gen3.png',
    altSprites: ['/sprites/trainers/gen3/lass-gen3rs.png'],
    pool: roster(
      PIDGEY,
      RATTATA,
      NIDORAN_F,
      NIDORINA,
      JIGGLYPUFF,
      CLEFAIRY,
      ODDISH,
      BELLSPROUT,
      MEOWTH,
      PIKACHU,
    ),
  },
  {
    id: 'BROCK',
    displayName: 'Brock',
    spritePath: '/sprites/trainers/gen3/brock-gen3.png',
    pool: roster(
      evolutionFamily(GEODUDE),
      ONIX,
      evolutionFamily(SANDSHREW),
      evolutionFamily(ZUBAT),
      evolutionFamily(RHYHORN),
      evolutionFamily(OMANYTE),
      evolutionFamily(KABUTO),
      AERODACTYL,
    ),
  },
  {
    id: 'HIKER',
    displayName: 'Montanhista',
    spritePath: '/sprites/trainers/gen3/hiker-gen3.png',
    altSprites: ['/sprites/trainers/gen3/hiker-gen3rs.png'],
    pool: roster(
      evolutionFamily(MACHOP),
      evolutionFamily(GEODUDE),
      ONIX,
      evolutionFamily(RHYHORN),
      evolutionFamily(MANKEY),
    ),
  },
  {
    id: 'BRENDAN',
    displayName: 'Brendan',
    spritePath: '/sprites/trainers/gen3/brendan-gen3.png',
    altSprites: ['/sprites/trainers/gen3/brendan-gen3rs.png'],
    pool: { kind: 'rival', lead: PIKACHU },
  },
  {
    id: 'MAY',
    displayName: 'May',
    spritePath: '/sprites/trainers/gen3/may-gen3.png',
    altSprites: ['/sprites/trainers/gen3/may-gen3rs.png'],
    pool: { kind: 'rival', lead: SQUIRTLE },
  },
  {
    id: 'LEAF',
    displayName: 'Leaf',
    spritePath: '/sprites/trainers/gen3/leaf-gen3.png',
    pool: { kind: 'rival', lead: BULBASAUR },
  },
  {
    id: 'RED',
    displayName: 'Red',
    spritePath: '/sprites/trainers/gen3/red-gen3.png',
    pool: { kind: 'rival', lead: CHARMANDER },
  },
  // Treinadores de Cerulean (Água/Gelo).
  {
    id: 'MISTY',
    displayName: 'Misty',
    spritePath: '/sprites/trainers/gen3/misty-gen3.png',
    pool: roster(
      evolutionFamily(STARYU),
      evolutionFamily(GOLDEEN),
      evolutionFamily(MAGIKARP),
      evolutionFamily(PSYDUCK),
      VAPOREON,
      evolutionFamily(SEEL),
      evolutionFamily(SQUIRTLE),
      evolutionFamily(KRABBY),
    ),
  },
  {
    id: 'PICNICKER',
    displayName: 'Campista',
    spritePath: '/sprites/trainers/gen3/picnicker-gen3.png',
    altSprites: ['/sprites/trainers/gen3/picnicker-gen3rs.png'],
    pool: roster(
      GOLDEEN,
      CUBONE,
      evolutionFamily(PIDGEY),
      ODDISH,
      GLOOM,
      BELLSPROUT,
      JIGGLYPUFF,
      CLEFAIRY,
      TANGELA,
      evolutionFamily(GOLDEEN),
      BULBASAUR,
      IVYSAUR,
    ),
  },
  {
    id: 'PARASOL_LADY',
    displayName: 'Dama do Guarda-Sol',
    spritePath: '/sprites/trainers/gen3/parasollady-gen3.png',
    pool: roster(
      evolutionFamily(JIGGLYPUFF),
      JYNX,
      evolutionFamily(KRABBY),
      evolutionFamily(DIGLETT),
      evolutionFamily(EXEGGCUTE),
      BELLSPROUT,
      MAGIKARP,
      GOLDEEN,
    ),
  },
  {
    id: 'FISHERMAN',
    displayName: 'Pescador',
    spritePath: '/sprites/trainers/gen3/fisherman-gen3.png',
    altSprites: ['/sprites/trainers/gen3/fisherman-gen3rs.png'],
    pool: roster(
      evolutionFamily(CLOYSTER),
      evolutionFamily(GOLDEEN),
      evolutionFamily(MAGIKARP),
      evolutionFamily(TENTACOOL),
      evolutionFamily(POLIWAG),
      evolutionFamily(STARYU),
      evolutionFamily(HORSEA),
    ),
  },
  {
    id: 'POKEFAN',
    displayName: 'Pokefã',
    spritePath: '/sprites/trainers/gen3/pokefan-gen3.png',
    pool: roster(
      evolutionFamily(PIKACHU),
      evolutionFamily(CHARMANDER),
      evolutionFamily(SQUIRTLE),
      evolutionFamily(BULBASAUR),
      evolutionFamily(EEVEE),
    ),
  },
  // Equipe Rocket — NÃO entram no pool de invasores do ginásio (só na missão Rocket Team).
  {
    id: 'ROCKET_TEAM_FEMALE',
    displayName: 'Equipe Rocket',
    spritePath: '/sprites/trainers/gen3/teamrocketgruntf-gen3.png',
    pool: roster(
      evolutionFamily(EKANS),
      evolutionFamily(RATTATA),
      evolutionFamily(MACHOP),
      evolutionFamily(MEOWTH),
      evolutionFamily(ODDISH),
    ),
  },
  {
    id: 'ROCKET_TEAM_MALE',
    displayName: 'Equipe Rocket',
    spritePath: '/sprites/trainers/gen3/teamrocketgruntm-gen3.png',
    pool: roster(
      evolutionFamily(KOFFING),
      evolutionFamily(SANDSHREW),
      evolutionFamily(DROWZEE),
      evolutionFamily(ZUBAT),
      evolutionFamily(CUBONE),
    ),
  },
]

const TRAINERS = new Map<TrainerId, TrainerDef>(TRAINER_LIST.map((t) => [t.id, t]))

/** Definição de um treinador por id (lança se inexistente — id inválido é erro de programação). */
export function getTrainer(id: TrainerId): TrainerDef {
  const trainer = TRAINERS.get(id)
  if (!trainer) throw new Error(`Treinador ${id} não encontrado`)
  return trainer
}
