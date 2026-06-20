// "Previsão do Dia" (topo da manhã): o bloco interno "Previsão do Tempo" (efeitos climáticos do dia,
// hoje só chuva; sem clima/chance zero = sol com tempo firme) somado às contagens do dia
// (missões normais, batalhas e missões Rocket — esta sempre mascarada para preservar o mistério).

import type { GameState } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getCityWeather, type WeatherEffectKind } from '../../data/cityWeather.ts'
import { rainAtLeastOnceChance } from '../../engine/weather.ts'
import { buildDayWeather } from '../../engine/storm.ts'
import { missionsForDay, defensesForDay } from '../../engine/timeline.ts'
import { hasCloudNine } from '../../engine/secretEffects.ts'
import { CLOUD_NINE_RAIN_CHANCE_BONUS_PP } from '../../engine/balance.ts'
import { theftChanceLabel } from '../../engine/theft.ts'
import styles from './DayForecastPanel.module.css'

const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva', storm: 'Tempestade' }

export function DayForecastPanel({ state }: { state: GameState }) {
  const city = getCity(state.run.cityIndex)
  const weather = getCityWeather(state.run.cityIndex)

  // Previsão = mesma função determinística que arma o dia (setupDay), com o MESMO bônus de Cloud
  // Nine — assim a % "bate com o que vai acontecer".
  const cloudNine = state.roster.filter(hasCloudNine).length
  const forecast = buildDayWeather(
    state.run.seed,
    state.run.day,
    city,
    cloudNine * CLOUD_NINE_RAIN_CHANCE_BONUS_PP,
  ).forecast
  const rainChance = rainAtLeastOnceChance(forecast.rainChancePercent, forecast.potentialRainCount)
  const stormChance = rainAtLeastOnceChance(forecast.stormChancePercent, forecast.potentialStormCount)

  const missions = missionsForDay(state.run.day)
  const defenses = defensesForDay(state.run.day)
  const theft = theftChanceLabel(state.run.theftChance)

  return (
    <section className={styles.panel}>
      <span className={styles.sectionTitle}>PREVISÃO DO DIA</span>

      <div className={styles.weather}>
        <span className={styles.subTitle}>PREVISÃO DO TEMPO</span>
        <div className={styles.effects}>
          {/* Cada WeatherEffectKind tem a sua própria chance combinada. */}
          {weather && (rainChance > 0 || stormChance > 0) ? (
            weather.effects.map((effect) =>
              effect.kind === 'rain' && rainChance > 0 ? (
                <div key="rain" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">
                    {EFFECT_ICON.rain}
                  </span>
                  <span className={styles.effectName}>{EFFECT_NAME.rain}</span>
                  <span className={styles.effectChance}>{rainChance}%</span>
                </div>
              ) : effect.kind === 'storm' && stormChance > 0 ? (
                <div key="storm" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">
                    {EFFECT_ICON.storm}
                  </span>
                  <span className={styles.effectName}>{EFFECT_NAME.storm}</span>
                  <span className={styles.effectChance}>{stormChance}%</span>
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

      <div className={styles.counts}>
        <div className={styles.count}>
          <span className={styles.countIcon} aria-hidden="true">🎯</span>
          <span className={styles.countValue}>{missions}</span>
          <span className={styles.countLabel}>Missões</span>
        </div>
        <div className={styles.count}>
          <span className={styles.countIcon} aria-hidden="true">⚔️</span>
          <span className={styles.countValue}>{defenses}</span>
          <span className={styles.countLabel}>Batalhas</span>
        </div>
        <div className={styles.count}>
          <span className={`${styles.countIcon} ${styles.rocketIcon}`} aria-hidden="true">🚨</span>
          <span
            className={`${styles.countValue} ${styles.rocketValue}`}
            style={{ color: theft.color }}
            title={`Chance de roubo hoje: ${state.run.theftChance}%`}
          >
            {theft.label}
          </span>
          <span className={styles.countLabel}>Chance de Rocket</span>
        </div>
      </div>
    </section>
  )
}
