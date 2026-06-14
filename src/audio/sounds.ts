// Camada de áudio (efeitos colaterais): manifesto de sons + player + estado de mute.
// A engine/o reducer permanecem puros — quem dispara sons é a UI (useGameSounds) e o
// clique global no App. Tocar é "best-effort": se o arquivo não existir ou o navegador
// bloquear o autoplay, falha em silêncio (sem quebrar o jogo).

/** Chaves lógicas dos sons → arquivos em public/sounds (servidos como /sounds/*.mp3). */
export type SoundKey =
  | 'missionNew'
  | 'missionSuccess'
  | 'missionFail'
  | 'timeWarning'
  | 'levelUp'
  | 'select'
  | 'deselect'

const SOUND_FILES: Record<SoundKey, string> = {
  missionNew: '/sounds/mission-new.mp3',
  missionSuccess: '/sounds/mission-success.mp3',
  missionFail: '/sounds/mission-fail.mp3',
  timeWarning: '/sounds/time-warning.mp3',
  levelUp: '/sounds/level-up.mp3',
  select: '/sounds/select.mp3',
  deselect: '/sounds/deselect.mp3',
}

/** Volume por som (0–1). Select/deselect são discretos por tocar o tempo todo. */
const VOLUME: Record<SoundKey, number> = {
  missionNew: 0.7,
  missionSuccess: 0.8,
  missionFail: 0.8,
  timeWarning: 0.8,
  levelUp: 0.9,
  select: 0.35,
  deselect: 0.35,
}

// --- Estado de mute (compartilhado pelo botão e pelo player), persistido ---------------

const STORAGE_KEY = 'pbk.muted'
const listeners = new Set<() => void>()

function readInitialMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = readInitialMuted()

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  if (value === muted) return
  muted = value
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* localStorage indisponível — segue só em memória */
  }
  for (const l of listeners) l()
}

export function toggleMuted(): void {
  setMuted(!muted)
}

/** Assina mudanças de mute (para useSyncExternalStore no botão). */
export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// --- Player -----------------------------------------------------------------------------

// Um elemento "base" por som, pré-carregado. Cada disparo clona o nó para permitir
// sobreposição (ex.: dois cliques rápidos) sem cortar o som anterior.
const bases = new Map<SoundKey, HTMLAudioElement>()

function getBase(key: SoundKey): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null // SSR / ambiente sem DOM
  let base = bases.get(key)
  if (!base) {
    base = new Audio(SOUND_FILES[key])
    base.preload = 'auto'
    bases.set(key, base)
  }
  return base
}

/** Toca um som, respeitando o mute. Nunca lança: erros (arquivo ausente, autoplay) são ignorados. */
export function playSound(key: SoundKey): void {
  if (muted) return
  const base = getBase(key)
  if (!base) return
  const node = base.cloneNode() as HTMLAudioElement
  node.volume = VOLUME[key]
  void node.play().catch(() => {
    /* autoplay bloqueado ou arquivo ausente — ignora */
  })
}
