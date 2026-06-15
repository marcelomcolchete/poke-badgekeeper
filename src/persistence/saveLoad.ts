// Persistência: slot único com autosave no localStorage + schema versionado (PLAN §5).

import type { GameState } from '../engine/state.ts'
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

  if (version !== SAVE_VERSION) return null
  return { version, savedAtMs: (file as SaveFile).savedAtMs, state } as unknown as SaveFile
}
