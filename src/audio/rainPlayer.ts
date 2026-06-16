// Player do som de chuva — em LOOP com fade in/out, separado do one-shot de sounds.ts. O volume
// sobe nos primeiros instantes (parece que começou a chover) e desce no fim (parece que parou).
// Respeita o mute e o volume mestre via as assinaturas de sounds.ts. Best-effort: erros (autoplay
// bloqueado, arquivo ausente) falham em silêncio.

import { getVolume, isMuted, subscribeMuted, subscribeVolume } from './sounds.ts'

const RAIN_SRC = '/sounds/weather/rain.mp3'
/** Volume "cheio" da chuva (antes do volume mestre). */
const RAIN_BASE_VOLUME = 0.6
/** Passo do fade por tique e intervalo do tique (≈1.2s para um fade completo). */
const FADE_STEP = 0.04
const FADE_MS = 80

let el: HTMLAudioElement | null = null
/** Intenção atual (true = deve estar chovendo); o volume converge para o alvo correspondente. */
let intended = false
let fadeTimer: ReturnType<typeof setInterval> | null = null

function ensureEl(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null // SSR / sem DOM
  if (!el) {
    el = new Audio(RAIN_SRC)
    el.loop = true
    el.preload = 'auto'
    el.volume = 0
  }
  return el
}

/** Volume-alvo agora: 0 se parando ou mudo; senão o volume-base × volume mestre. */
function targetVolume(): number {
  return intended && !isMuted() ? RAIN_BASE_VOLUME * getVolume() : 0
}

function stopFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

/** Inicia (ou mantém) o laço de fade que aproxima o volume do alvo a cada tique. */
function ensureFade(): void {
  if (fadeTimer !== null) return
  fadeTimer = setInterval(() => {
    const a = el
    if (!a) return stopFade()
    const t = targetVolume()
    // Voltou a chover após mudo/parada: retoma o play antes de subir o volume.
    if (t > 0 && a.paused) void a.play().catch(() => {})
    if (a.volume < t) a.volume = Math.min(t, a.volume + FADE_STEP)
    else if (a.volume > t) a.volume = Math.max(t, a.volume - FADE_STEP)
    if (Math.abs(a.volume - t) < 1e-3) {
      a.volume = t
      if (t === 0) {
        a.pause()
        a.currentTime = 0
      }
      stopFade()
    }
  }, FADE_MS)
}

/** Começa/segue a chuva: toca em loop e sobe o volume gradualmente. */
export function startRain(): void {
  const a = ensureEl()
  if (!a) return
  intended = true
  void a.play().catch(() => {})
  ensureFade()
}

/** Para a chuva: desce o volume gradualmente e pausa ao chegar a zero. */
export function stopRain(): void {
  intended = false
  if (!el) return
  ensureFade()
}

// Mute/volume mudam ao vivo: re-converge o volume da chuva (sobe, abaixa ou silencia).
subscribeMuted(() => {
  if (el) ensureFade()
})
subscribeVolume(() => {
  if (el) ensureFade()
})
