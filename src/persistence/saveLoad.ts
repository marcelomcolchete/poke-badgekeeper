// Persistência: slot único com autosave no localStorage + schema versionado (PLAN §5).

import type { GameState } from '../engine/state.ts'
import { emptyWeatherSchedule } from '../engine/weather.ts'
import { SAVE_KEY, SAVE_VERSION } from '../engine/constants.ts'

export interface SaveFile {
  version: number
  savedAtMs: number
  state: GameState
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Grava o estado atual (autosave). `nowMs` é injetado para manter a engine pura. */
export function saveGame(state: GameState, nowMs: number): void {
  const storage = getStorage()
  if (!storage) return
  const file: SaveFile = { version: SAVE_VERSION, savedAtMs: nowMs, state }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(file))
  } catch {
    // Cota cheia / modo privado: falha de save é não-fatal por ora.
  }
}

/** Carrega e migra o save. Retorna null se ausente, corrompido ou incompatível. */
export function loadGame(): GameState | null {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SaveFile>
    const migrated = migrate(parsed)
    return migrated ? migrated.state : null
  } catch {
    return null
  }
}

export function hasSave(): boolean {
  return getStorage()?.getItem(SAVE_KEY) != null
}

export function clearSave(): void {
  getStorage()?.removeItem(SAVE_KEY)
}

/**
 * Migração de schema. Encadeia transformações vN → vN+1 até chegar na versão atual.
 * Saves de versão incompatível (muito antigos) são descartados.
 */
function migrate(file: Partial<SaveFile>): SaveFile | null {
  if (!file || typeof file.version !== 'number' || !file.state) return null

  let { version, state } = file as unknown as { version: number; state: Record<string, unknown> }

  // v11 → v12: adiciona nature: null a todos os Pokémon do roster.
  if (version === 11) {
    const roster = state.roster as Array<Record<string, unknown>> | undefined
    if (Array.isArray(roster)) {
      state = {
        ...state,
        roster: roster.map((p) => ({ nature: null, ...p })),
      }
    }
    version = 12
  }

  // v12 → v13: variação de encontro (ivs zerados = rank C) em cada Pokémon do roster.
  if (version === 12) {
    const zeroIvs = {
      batalha: 0,
      inteligencia: 0,
      carisma: 0,
      agilidade: 0,
      resistencia: 0,
      percepcao: 0,
    }
    const roster = state.roster as Array<Record<string, unknown>> | undefined
    if (Array.isArray(roster)) {
      state = {
        ...state,
        roster: roster.map((p) => ({ ivs: zeroIvs, ...p })),
      }
    }
    version = 13
  }

  // v13 → v14: contador de defesas perdidas no dia (relatório de falhas).
  if (version === 13) {
    const today = state.today as Record<string, unknown> | undefined
    if (today && typeof today === 'object') {
      state = { ...state, today: { defensesLost: 0, ...today } }
    }
    version = 14
  }

  // v14 → v15: lista de inimigos derrotados em defesas no dia (MVP por derrotas).
  if (version === 14) {
    const today = state.today as Record<string, unknown> | undefined
    if (today && typeof today === 'object') {
      state = { ...state, today: { defenseKills: [], ...today } }
    }
    version = 15
  }

  // v15 → v16: Habilidade Secreta desbloqueada no dia (reveal no resumo).
  if (version === 15) {
    const today = state.today as Record<string, unknown> | undefined
    if (today && typeof today === 'object') {
      state = { ...state, today: { secretUnlock: null, ...today } }
    }
    version = 16
  }

  // v16 → v17: rebalanceamento das missões. As instâncias antigas têm templateIds e
  // formato incompatíveis (sem requirement); limpa-as e libera Pokémon presos nelas.
  if (version === 16) {
    const missions = state.missions as Array<{ teamIds?: string[] }> | undefined
    if (Array.isArray(missions)) {
      const stranded = new Set(missions.flatMap((m) => m.teamIds ?? []))
      const roster = state.roster as Array<Record<string, unknown>> | undefined
      state = {
        ...state,
        missions: [],
        roster: Array.isArray(roster)
          ? roster.map((p) =>
              stranded.has(p.id as string) && p.status !== 'fainted' ? { ...p, status: 'idle' } : p,
            )
          : roster,
      }
    }
    version = 17
  }

  // v17 → v18: estado diário das Habilidades Secretas e túnel do Dig.
  if (version === 17) {
    const today = state.today as Record<string, unknown> | undefined
    if (today && typeof today === 'object') {
      state = { ...state, today: { secretRuntime: {}, digTunnel: null, ...today } }
    }
    version = 18
  }

  // v18 → v19: XP de missão por pool (mission.xpAwards) e XP de ginásio por poder. Ambos
  // são opcionais/derivados — missões em voo sem xpAwards caem no fallback 0. Só passa.
  if (version === 18) {
    version = 19
  }

  // v19 → v20: remove museu/Fossil e adiciona a missão Equipe Rocket. Descarta missões de
  // museu antigas (templateId 'museu'), libera Pokémon presos nelas e tira 'fossil' de runItems.
  if (version === 19) {
    const missions = state.missions as Array<{ teamIds?: string[]; templateId?: string }> | undefined
    if (Array.isArray(missions)) {
      const stranded = new Set(
        missions.filter((m) => m.templateId === 'museu').flatMap((m) => m.teamIds ?? []),
      )
      const roster = state.roster as Array<Record<string, unknown>> | undefined
      state = {
        ...state,
        missions: missions.filter((m) => m.templateId !== 'museu'),
        roster: Array.isArray(roster)
          ? roster.map((p) =>
              stranded.has(p.id as string) && p.status !== 'fainted' ? { ...p, status: 'idle' } : p,
            )
          : roster,
      }
    }
    const runItems = state.runItems as string[] | undefined
    if (Array.isArray(runItems)) {
      state = { ...state, runItems: runItems.filter((i) => i !== 'fossil') }
    }
    version = 20
  }

  // v20 → v21: níveis das Habilidades Secretas. Quem já tinha a passiva 'secret-*' ganha
  // o nível 1 (Bronze já conquistado); demais ficam sem secretLevel.
  if (version === 20) {
    const roster = state.roster as Array<Record<string, unknown>> | undefined
    if (Array.isArray(roster)) {
      state = {
        ...state,
        roster: roster.map((p) => {
          const passives = (p.passives as string[] | undefined) ?? []
          const hasSecret = passives.some((id) => id.startsWith('secret-'))
          return hasSecret && p.secretLevel === undefined ? { ...p, secretLevel: 1 } : p
        }),
      }
    }
    version = 21
  }

  // v21 → v22: sistema de itens. dayBuffs (itens x_*) é opcional e some na virada do dia; os
  // itens passivos reaproveitam s.runItems (já existente). Nada a preencher — passthrough.
  if (version === 21) {
    version = 22
  }

  // v22 → v23: mercado fixo no dia. Inicia today.shopOffer/purchasedItems vazios; a UI deriva
  // a oferta quando vazia (saves carregados no meio do dia não dependem dela).
  if (version === 22) {
    const today = state.today as Record<string, unknown> | undefined
    if (today && typeof today === 'object') {
      state = { ...state, today: { shopOffer: [], purchasedItems: [], ...today } }
    }
    version = 23
  }

  // v23 → v24: Computador (PC) e Pokédex da área. Inicia box vazio e caughtSpecies com as
  // espécies já presentes no roster (o jogador "já capturou" o que tem em mãos).
  if (version === 23) {
    const roster = state.roster as Array<{ speciesId?: number }> | undefined
    const caught = Array.isArray(roster)
      ? [...new Set(roster.map((p) => p.speciesId).filter((id): id is number => typeof id === 'number'))]
      : []
    state = { box: [], caughtSpecies: caught, ...state }
    version = 24
  }

  // v24 → v25: bola evolutiva. Saves antigos começam sem bola (run.ballLevel = 0 → só Comum
  // na exploração até comprar a Pokébola grátis). Encontros antigos não têm rankWindow → sem
  // limite (passthrough).
  if (version === 24) {
    const run = state.run as Record<string, unknown> | undefined
    if (run && typeof run === 'object') {
      state = { ...state, run: { ballLevel: 0, ...run } }
    }
    version = 25
  }

  // v25 → v26: Habilidades Secretas viram TRÊS por linha. secretLevel → secretCount (mesma
  // quantidade já desbloqueada), remove passivas 'secret-*'/'sturdy-spent', digTunnel → digTunnels,
  // e limpa o reveal do dia (formato incompatível).
  if (version === 25) {
    const migrateMon = (p: Record<string, unknown>): Record<string, unknown> => {
      const passives = (p.passives as string[] | undefined) ?? []
      const hadSecret = passives.some((id) => id.startsWith('secret-'))
      const level = typeof p.secretLevel === 'number' ? p.secretLevel : hadSecret ? 1 : 0
      const rest = { ...p }
      delete rest.secretLevel
      return {
        ...rest,
        passives: passives.filter((id) => !id.startsWith('secret-') && id !== 'sturdy-spent'),
        secretCount: Math.min(3, Math.max(0, Math.round(level))),
      }
    }
    const mapRoster = (arr: unknown): unknown =>
      Array.isArray(arr) ? arr.map((p) => migrateMon(p as Record<string, unknown>)) : arr
    const today = state.today as Record<string, unknown> | undefined
    const oldTunnel = today?.digTunnel
    state = {
      ...state,
      roster: mapRoster(state.roster),
      box: mapRoster(state.box),
      today:
        today && typeof today === 'object'
          ? {
              ...today,
              digTunnels: Array.isArray(oldTunnel) && oldTunnel.length >= 2 ? [oldTunnel] : [],
              secretUnlock: null,
            }
          : today,
    } as typeof state
    version = 26
  }

  // v26 → v27: efeitos climáticos. Inicia s.weather vazio (recalculado no próximo setupDay);
  // missões em andamento não têm campos de clima (passthrough — sem poças retroativas).
  if (version === 26) {
    state = { weather: emptyWeatherSchedule(), ...state }
    version = 27
  }

  // v27 → v28: Percepção → centro de rank contínuo (cada ponto conta) em vez de janela em
  // degraus. Encontros pendentes convertem rankWindow [lo,hi] no centro (lo+hi)/2; sem janela
  // ficam sem viés. O rank exibido num encontro carregado pode mudar levemente (algoritmo novo).
  if (version === 27) {
    const encounters = state.encounters as Array<Record<string, unknown>> | undefined
    if (Array.isArray(encounters)) {
      state = {
        ...state,
        encounters: encounters.map((e) => {
          const win = e.rankWindow as [number, number] | undefined
          const rest = { ...e }
          delete rest.rankWindow
          return Array.isArray(win) ? { ...rest, rankCenter: (win[0] + win[1]) / 2 } : rest
        }),
      } as typeof state
    }
    version = 28
  }

  // v28 → v29: medalhas dos invasores (Bronze/Prata/Ouro) substituem o destaque único `buffed`.
  // A Batalha já vem com o +15 antigo embutido — só o selo muda: buffed → medal:'silver' (o tier
  // cujo bônus +20 mais se aproxima do +15). Aplica nas defesas e na batalha Rocket em andamento.
  if (version === 28) {
    const fixEnemies = (arr: unknown): unknown =>
      Array.isArray(arr)
        ? arr.map((e) => {
            const enemy = e as Record<string, unknown>
            if (!enemy.buffed) return enemy
            const rest = { ...enemy }
            delete rest.buffed
            return { ...rest, medal: 'silver' }
          })
        : arr
    const defenses = state.defenses as Array<Record<string, unknown>> | undefined
    const missions = state.missions as Array<Record<string, unknown>> | undefined
    state = {
      ...state,
      defenses: Array.isArray(defenses)
        ? defenses.map((d) => ({ ...d, enemies: fixEnemies(d.enemies) }))
        : defenses,
      missions: Array.isArray(missions)
        ? missions.map((m) => {
            const rocket = m.rocket as Record<string, unknown> | undefined
            return rocket && typeof rocket === 'object'
              ? { ...m, rocket: { ...rocket, enemies: fixEnemies(rocket.enemies) } }
              : m
          })
        : missions,
    } as typeof state
    version = 29
  }

  if (version !== SAVE_VERSION) return null
  return { version, savedAtMs: (file as SaveFile).savedAtMs, state } as unknown as SaveFile
}
