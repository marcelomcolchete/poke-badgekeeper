// Player do som de nevasca — loop com fade in/out, espelha heatPlayer. Best-effort: erros (autoplay
// bloqueado, arquivo ausente) falham em silêncio. Respeita mute + volume mestre.

import { getVolume, isMuted, subscribeMuted, subscribeVolume } from './sounds.ts'

const SNOW_SRC = '/sounds/weather/snowstorm.mp3'
const SNOW_BASE_VOLUME = 0.5
const FADE_STEP = 0.04
const FADE_MS = 80

let el: HTMLAudioElement | null = null
let intended = false
let fadeTimer: ReturnType<typeof setInterval> | null = null

function ensureEl(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!el) {
    el = new Audio(SNOW_SRC)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
  }
  return el
}

function targetVolume(): number {
  return intended && !isMuted() ? SNOW_BASE_VOLUME * getVolume() : 0
}

function stopFade(): void {
  if (fadeTimer !== null) { clearInterval(fadeTimer); fadeTimer = null }
}

function ensureFade(): void {
  if (fadeTimer !== null) return
  fadeTimer = setInterval(() => {
    const a = el
    if (!a) return stopFade()
    const t = targetVolume()
    if (t > 0 && a.paused) void a.play().catch(() => {})
    if (a.volume < t) a.volume = Math.min(t, a.volume + FADE_STEP)
    else if (a.volume > t) a.volume = Math.max(t, a.volume - FADE_STEP)
    if (Math.abs(a.volume - t) < 1e-3) {
      a.volume = t
      if (t === 0) { a.pause(); a.currentTime = 0 }
      stopFade()
    }
  }, FADE_MS)
}

export function startSnow(): void {
  const a = ensureEl()
  if (!a) return
  intended = true
  void a.play().catch(() => {})
  ensureFade()
}

export function stopSnow(): void {
  intended = false
  if (!el) return
  ensureFade()
}

subscribeMuted(() => { if (el) ensureFade() })
subscribeVolume(() => { if (el) ensureFade() })
