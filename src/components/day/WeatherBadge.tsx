// Selo do efeito climático ativo (canto superior direito da fase Dia). Circular, com emoji do
// efeito. Chuva e Tempestade são os dois efeitos suportados.

import type { WeatherEffectKind } from '../../data/cityWeather.ts'
import styles from './WeatherBadge.module.css'

const WEATHER_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️' }

const WEATHER_LABEL: Record<WeatherEffectKind, string> = { rain: 'Chovendo', storm: 'Tempestade' }

export function WeatherBadge({ kind }: { kind: WeatherEffectKind }) {
  return (
    <span className={`${styles.badge} ${styles[kind] ?? ''}`} title={WEATHER_LABEL[kind]} role="img" aria-label={WEATHER_LABEL[kind]}>
      {WEATHER_ICON[kind]}
    </span>
  )
}
