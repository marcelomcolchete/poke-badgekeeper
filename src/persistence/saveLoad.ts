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

  if (version !== SAVE_VERSION) return null
  return { version, savedAtMs: (file as SaveFile).savedAtMs, state } as unknown as SaveFile
}
