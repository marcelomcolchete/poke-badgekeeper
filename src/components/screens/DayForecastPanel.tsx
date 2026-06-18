// "Previsão do Dia" (topo da manhã): o bloco interno "Previsão do Tempo" (efeitos climáticos do dia,
// hoje só chuva; sem clima/chance zero = sol com tempo firme) somado às contagens do dia
// (missões normais, batalhas e missões Rocket — esta sempre mascarada para preservar o mistério).

import type { GameState } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getCityWeather, type WeatherEffectKind } from '../../data/cityWeather.ts'
import { buildWeatherSchedule, rainAtLeastOnceChance } from '../../engine/weather.ts'
import { missionsForDay, defensesForDay } from '../../engine/timeline.ts'
import { hasCloudNine } from '../../engine/secretEffects.ts'
import { CLOUD_NINE_RAIN_CHANCE_BONUS_PP } from '../../engine/balance.ts'
import styles from './DayForecastPanel.module.css'

const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva' }

export function DayForecastPanel({ state }: { state: GameState }) {
  const city = getCity(state.run.cityIndex)
  const weather = getCityWeather(state.run.cityIndex)

  // Previsão = mesma função determinística que arma o dia (setupDay), com o MESMO bônus de Cloud
  // Nine — assim a % "bate com o que vai acontecer".
  const cloudNine = state.roster.filter(hasCloudNine).length
  const forecast = buildWeatherSchedule(
    state.run.seed,
    state.run.day,
    city,
    cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP,
  ).forecast
  const rainChance = rainAtLeastOnceChance(forecast.rainChancePercent, forecast.potentialRainCount)

  const missions = missionsForDay(state.run.day)
  const defenses = defensesForDay(state.run.day)

  return (
    <section className={styles.panel}>
      <span className={styles.sectionTitle}>PREVISÃO DO DIA</span>

      <div className={styles.weather}>
        <span className={styles.subTitle}>PREVISÃO DO TEMPO</span>
        <div className={styles.effects}>
          {/* Hoje só há chuva: `rainChance` (combinado) modela ESTE efeito. Ao adicionar um novo
              WeatherEffectKind, calcular a chance própria dele — não reusar `rainChance` aqui. */}
          {weather && rainChance > 0 ? (
            weather.effects.map((effect) =>
              effect.kind === 'rain' ? (
                <div key="rain" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">
                    {EFFECT_ICON.rain}
                  </span>
                  <span className={styles.effectName}>{EFFECT_NAME.rain}</span>
                  <span className={styles.effectChance}>{rainChance}%</span>
                </div>
              ) : null,
            )
          ) : (
            <div className={styles.effect}>
              <span className={styles.effectIcon} aria-hidden="true">
                ☀️
              </span>
              <span className={styles.calm}>Tempo firme hoje</span>
            </div>
          )}
        </div>
      </div>

      <dl className={styles.counts}>
        <div className={styles.count}>
          <dt>Quantidade de Missões</dt>
          <dd>{missions}</dd>
        </div>
        <div className={styles.count}>
          <dt>Quantidade de Batalhas</dt>
          <dd>{defenses}</dd>
        </div>
        <div className={`${styles.count} ${styles.rocket}`}>
          <dt>Quantidade de Missões Rocket</dt>
          <dd title="A previsão não revela os dias da Equipe Rocket">???</dd>
        </div>
      </dl>
    </section>
  )
}
