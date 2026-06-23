// Configuração de efeitos climáticos POR CIDADE (extensível). Hoje só Cerulean (índice 1) tem
// clima — Chuva. Cada cidade lista, EM ORDEM, os efeitos que podem aparecer no dia (a previsão
// da manhã os lista nessa ordem). Adicionar um efeito futuro = acrescentar à lista `effects`
// aqui e tratar o `kind` em engine/weather.ts.

/** Tipos de efeito climático conhecidos. Futuro: 'sun' | 'sandstorm' | 'snow' … */
export type WeatherEffectKind = 'rain' | 'storm'

/** Parâmetros da chance de um efeito: piso cresce por dia até travar no teto (regime do infinito). */
export interface WeatherChanceFormula {
  /** Piso conceitual no "dia 0". */
  pisoBase: number
  /** Quanto o piso sobe por dia. */
  pisoPorDia: number
  /** Teto fixo: valor de regime quando o piso o alcança. */
  teto: number
}

/** Efeito de Chuva: deixa poças pelo mapa (água temporária) — ver engine/weather.ts. */
export interface RainEffectConfig {
  kind: 'rain'
  chance: WeatherChanceFormula
}

/** Efeito de Tempestade: raios que caem pelo mapa (dano + Paralyze) — ver engine/storm.ts. */
export interface StormEffectConfig {
  kind: 'storm'
  chance: WeatherChanceFormula
}

export type WeatherEffectConfig = RainEffectConfig | StormEffectConfig

export interface CityWeather {
  /** Efeitos possíveis nesta cidade, na ordem de exibição da previsão. */
  effects: WeatherEffectConfig[]
}

/** cityIndex → clima da cidade. Ausente = cidade sem clima (a maioria, por ora). */
const CITY_WEATHER: Record<number, CityWeather> = {
  // Cerulean (Água/Gelo): só chuva.
  1: { effects: [{ kind: 'rain', chance: { pisoBase: 40, pisoPorDia: 1, teto: 70 } }] },
  // Vermilion (Elétrico/Dragão): chuva + tempestade (raios encadeiam nas poças).
  2: {
    effects: [
      { kind: 'rain', chance: { pisoBase: 15, pisoPorDia: 2, teto: 60 } },
      { kind: 'storm', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
    ],
  },
}

/** Clima configurado para a cidade, ou null se ela não tem efeitos climáticos. */
export function getCityWeather(cityIndex: number): CityWeather | null {
  return CITY_WEATHER[cityIndex] ?? null
}

/** A cidade tem o efeito de Chuva habilitado? */
export function cityHasRain(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'rain') ?? false
}

/** A cidade tem o efeito de Tempestade habilitado? */
export function cityHasStorm(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'storm') ?? false
}

/** Fórmula de chance de Chuva da cidade, ou null se ela não tem o efeito. */
export function cityRainChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'rain')
  return e ? e.chance : null
}

/** Fórmula de chance de Tempestade da cidade, ou null se ela não tem o efeito. */
export function cityStormChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'storm')
  return e ? e.chance : null
}
