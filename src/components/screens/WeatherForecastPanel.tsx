// "Previsão do tempo" da manhã (acima do mercado): lista os efeitos climáticos que PODEM ocorrer
// hoje na cidade e a chance de cada um. Pensado para crescer (vários efeitos no futuro) — cada
// efeito vira um card numa faixa horizontal. Não renderiza nada em cidades sem clima.

import type { GameState } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getCityWeather, type WeatherEffectKind } from '../../data/cityWeather.ts'
import { buildWeatherSchedule } from '../../engine/weather.ts'
import styles from './WeatherForecastPanel.module.css'

const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva' }

export function WeatherForecastPanel({ state }: { state: GameState }) {
  const weather = getCityWeather(state.run.cityIndex)
  if (!weather) return null

  const city = getCity(state.run.cityIndex)
  // Previsão = mesma função determinística que arma o dia (setupDay). Bate com o que vai acontecer.
  const forecast = buildWeatherSchedule(state.run.seed, state.run.day, city).forecast

  return (
    <section className={styles.panel}>
      <span className={styles.sectionTitle}>PREVISÃO DO TEMPO</span>
      <div className={styles.cards}>
        {weather.effects.map((effect) => {
          if (effect.kind === 'rain') {
            const calm = forecast.rainChancePercent === 0
            return (
              <div key="rain" className={styles.card}>
                <span className={styles.cardIcon} aria-hidden="true">
                  {calm ? '☀️' : EFFECT_ICON.rain}
                </span>
                <span className={styles.cardName}>{EFFECT_NAME.rain}</span>
                {calm ? (
                  <span className={styles.calm}>Tempo firme hoje</span>
                ) : (
                  <dl className={styles.stats}>
                    <div className={styles.stat}>
                      <dt>Chance de Chuva</dt>
                      <dd>{forecast.rainChancePercent}%</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Quantidade de Chuva</dt>
                      <dd>{forecast.rainMmPerHour} mm/h</dd>
                    </div>
                    <div className={styles.stat}>
                      <dt>Pancadas possíveis</dt>
                      <dd>até {forecast.potentialRainCount}×</dd>
                    </div>
                  </dl>
                )}
              </div>
            )
          }
          return null
        })}
      </div>
    </section>
  )
}
