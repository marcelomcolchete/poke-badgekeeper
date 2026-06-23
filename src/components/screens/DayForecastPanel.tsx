// "Previsão do Dia" (topo da manhã): o bloco interno "Previsão do Tempo" (efeitos climáticos do dia,
// hoje só chuva; sem clima/chance zero = sol com tempo firme) somado às contagens do dia
// (missões normais, batalhas e missões Rocket — esta sempre mascarada para preservar o mistério).

import type { GameState } from '../../engine/state.ts'
import { getCity } from '../../data/cities.ts'
import { getCityWeather, type WeatherEffectKind } from '../../data/cityWeather.ts'
import { rainAtLeastOnceChance } from '../../engine/weather.ts'
import { buildDayWeather } from '../../engine/storm.ts'
import { missionsForDay, defensesForDay } from '../../engine/timeline.ts'
import { hasOwnTempo } from '../../engine/secretEffects.ts'
import {
  CLOUD_NINE_RAIN_PP_L1,
  CLOUD_NINE_RAIN_PP_L2,
  CLOUD_NINE_OTHER_PP_L1,
  CLOUD_NINE_OTHER_PP_L2,
  OVERCOAT_PP_L1,
  OVERCOAT_PP_L2,
  OWN_TEMPO_CAP_L1,
  OWN_TEMPO_CAP_L2,
} from '../../engine/balance.ts'
import { secretLevelOf } from '../../data/secretAbilities.ts'
import { theftChanceLabel } from '../../engine/theft.ts'
import styles from './DayForecastPanel.module.css'

const EFFECT_ICON: Record<WeatherEffectKind, string> = { rain: '🌧️', storm: '⛈️', heat: '🔥' }
const EFFECT_NAME: Record<WeatherEffectKind, string> = { rain: 'Chuva', storm: 'Tempestade', heat: 'Calor' }

export function DayForecastPanel({ state }: { state: GameState }) {
  const city = getCity(state.run.cityIndex)
  const weather = getCityWeather(state.run.cityIndex)

  // Previsão = mesma função determinística que arma o dia (setupDay), com os MESMOS deltas
  // de Cloud Nine / Overcoat / Own Tempo — assim a % "bate com o que vai acontecer".
  let rainDelta = 0
  let stormDelta = 0
  let heatDelta = 0
  for (const p of state.roster) {
    const cnLevel = secretLevelOf(p, 'sa-cloud-nine')
    if (cnLevel === 2) { rainDelta += CLOUD_NINE_RAIN_PP_L2; stormDelta -= CLOUD_NINE_OTHER_PP_L2; heatDelta -= CLOUD_NINE_OTHER_PP_L2 }
    else if (cnLevel === 1) { rainDelta += CLOUD_NINE_RAIN_PP_L1; stormDelta -= CLOUD_NINE_OTHER_PP_L1; heatDelta -= CLOUD_NINE_OTHER_PP_L1 }
    const ocLevel = secretLevelOf(p, 'sa-overcoat')
    if (ocLevel === 2) { rainDelta -= OVERCOAT_PP_L2; stormDelta -= OVERCOAT_PP_L2; heatDelta -= OVERCOAT_PP_L2 }
    else if (ocLevel === 1) { rainDelta -= OVERCOAT_PP_L1; stormDelta -= OVERCOAT_PP_L1; heatDelta -= OVERCOAT_PP_L1 }
  }
  let ownTempoCap = 0
  if (state.roster.some((p) => hasOwnTempo(p) && secretLevelOf(p, 'sa-own-tempo') === 2)) {
    ownTempoCap = OWN_TEMPO_CAP_L2
  } else if (state.roster.some(hasOwnTempo)) {
    ownTempoCap = OWN_TEMPO_CAP_L1
  }
  const forecast = buildDayWeather(
    state.run.seed,
    state.run.day,
    city,
    rainDelta,
    stormDelta,
    heatDelta,
    ownTempoCap,
  ).forecast
  const rainChance = rainAtLeastOnceChance(forecast.rainChancePercent, forecast.potentialRainCount)
  const stormChance = rainAtLeastOnceChance(forecast.stormChancePercent, forecast.potentialStormCount)
  const heatChance = rainAtLeastOnceChance(forecast.heatChancePercent, forecast.potentialHeatCount)

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
          {weather && (rainChance > 0 || stormChance > 0 || heatChance > 0) ? (
            weather.effects.map((effect) =>
              effect.kind === 'heat' && heatChance > 0 ? (
                <div key="heat" className={styles.effect}>
                  <span className={styles.effectIcon} aria-hidden="true">{EFFECT_ICON.heat}</span>
                  <span className={styles.effectName}>{EFFECT_NAME.heat}</span>
                  <span className={styles.effectChance}>{heatChance}%</span>
                </div>
              ) : effect.kind === 'rain' && rainChance > 0 ? (
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
            className={styles.rocketChip}
            style={{ backgroundColor: theft.color, color: theft.ink }}
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
