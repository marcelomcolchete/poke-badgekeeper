// Player dos sons de raio (Tempestade): one-shot SORTEADO entre thunder1..4. Separado do
// loop de chuva (rainPlayer) e dos SFX discretos (sounds.ts). Respeita mute + volume mestre.
// Best-effort: erros (autoplay bloqueado, arquivo ausente) falham em silêncio.

import { getVolume, isMuted } from './sounds.ts'

/** Os 4 sons de trovão em public/sounds/weather (servidos como /sounds/weather/*.mp3). */
const THUNDER_SRCS = [
  '/sounds/weather/thunder1.mp3',
  '/sounds/weather/thunder2.mp3',
  '/sounds/weather/thunder3.mp3',
  '/sounds/weather/thunder4.mp3',
]
/** Volume "cheio" do trovão (antes do volume mestre). */
const THUNDER_BASE_VOLUME = 0.7

// Um elemento "base" por arquivo, pré-carregado; cada disparo clona o nó para permitir
// sobreposição (dois raios próximos) sem cortar o anterior — mesmo padrão de sounds.ts.
const bases: (HTMLAudioElement | undefined)[] = []

function getBase(i: number): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null // SSR / ambiente sem DOM
  let base = bases[i]
  if (!base) {
    base = new Audio(THUNDER_SRCS[i])
    base.preload = 'auto'
    bases[i] = base
  }
  return base
}

/** Toca um dos 4 trovões (sorteado), respeitando o mute. Nunca lança. */
export function playThunder(): void {
  if (isMuted()) return
  const i = Math.floor(Math.random() * THUNDER_SRCS.length)
  const base = getBase(i)
  if (!base) return
  const node = base.cloneNode() as HTMLAudioElement
  node.volume = THUNDER_BASE_VOLUME * getVolume()
  void node.play().catch(() => {
    /* autoplay bloqueado ou arquivo ausente — ignora */
  })
}
