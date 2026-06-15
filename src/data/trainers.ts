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
  /** Arte em public/sprites/trainers (PNG com o id da classe). */
  spritePath: string
  pool: TrainerPool
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

const TRAINER_LIST: TrainerDef[] = [
  {
    id: 'YOUNGSTER',
    displayName: 'Jovem',
    spritePath: '/sprites/trainers/YOUNGSTER.png',
    pool: roster(CHARMANDER, BULBASAUR, SQUIRTLE, PIKACHU, EEVEE, RATTATA, PIDGEY, PIDGEOTTO),
  },
  {
    id: 'BIRD_KEEPER',
    displayName: 'Criador de Aves',
    spritePath: '/sprites/trainers/BIRD_KEEPER.png',
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
    spritePath: '/sprites/trainers/LASS.png',
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
    spritePath: '/sprites/trainers/BROCK.png',
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
    spritePath: '/sprites/trainers/HIKER.png',
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
    spritePath: '/sprites/trainers/BRENDAN.png',
    pool: { kind: 'rival', lead: PIKACHU },
  },
  {
    id: 'MAY',
    displayName: 'May',
    spritePath: '/sprites/trainers/MAY.png',
    pool: { kind: 'rival', lead: SQUIRTLE },
  },
  {
    id: 'LEAF',
    displayName: 'Leaf',
    spritePath: '/sprites/trainers/LEAF.png',
    pool: { kind: 'rival', lead: BULBASAUR },
  },
  {
    id: 'RED',
    displayName: 'Red',
    spritePath: '/sprites/trainers/RED.png',
    pool: { kind: 'rival', lead: CHARMANDER },
  },
]

const TRAINERS = new Map<TrainerId, TrainerDef>(TRAINER_LIST.map((t) => [t.id, t]))

/** Definição de um treinador por id (lança se inexistente — id inválido é erro de programação). */
export function getTrainer(id: TrainerId): TrainerDef {
  const trainer = TRAINERS.get(id)
  if (!trainer) throw new Error(`Treinador ${id} não encontrado`)
  return trainer
}
