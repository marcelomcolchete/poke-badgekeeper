// Configuração de efeitos climáticos POR CIDADE (extensível). Hoje só Cerulean (índice 1) tem
// clima — Chuva. Cada cidade lista, EM ORDEM, os efeitos que podem aparecer no dia (a previsão
// da manhã os lista nessa ordem). Adicionar um efeito futuro = acrescentar à lista `effects`
// aqui e tratar o `kind` em engine/weather.ts.

/** Tipos de efeito climático conhecidos. */
export type WeatherEffectKind = 'rain' | 'storm' | 'heat' | 'snowstorm' | 'sandstorm'

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

/** Efeito de Calor: janela quente que reduz a velocidade de viagem — ver engine/heat.ts. */
export interface HeatEffectConfig {
  kind: 'heat'
  chance: WeatherChanceFormula
}

/** Efeito de Nevasca: slowdown acumulado → congelamento + dano — ver engine/snow.ts. */
export interface SnowstormEffectConfig {
  kind: 'snowstorm'
  chance: WeatherChanceFormula
}

/** Efeito de Tempestade de areia: desvio por ponto aleatório do mapa — ver engine/sand.ts. */
export interface SandstormEffectConfig {
  kind: 'sandstorm'
  chance: WeatherChanceFormula
}

export type WeatherEffectConfig =
  | RainEffectConfig
  | StormEffectConfig
  | HeatEffectConfig
  | SnowstormEffectConfig
  | SandstormEffectConfig

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
  // Celadon (Grama/Inseto): calor + chuva + tempestade (na ordem da previsão).
  3: {
    effects: [
      { kind: 'heat', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
      { kind: 'rain', chance: { pisoBase: 10, pisoPorDia: 1, teto: 40 } },
      { kind: 'storm', chance: { pisoBase: 5, pisoPorDia: 1, teto: 20 } },
    ],
  },
  // Fuchsia (Veneno): chuva + tempestade de areia + calor.
  4: {
    effects: [
      { kind: 'rain', chance: { pisoBase: 20, pisoPorDia: 1, teto: 50 } },
      { kind: 'sandstorm', chance: { pisoBase: 15, pisoPorDia: 1, teto: 45 } },
      { kind: 'heat', chance: { pisoBase: 12, pisoPorDia: 1, teto: 35 } },
    ],
  },
  // Saffron (Psíquico): nevasca (dominante) + chuva + tempestade.
  5: {
    effects: [
      { kind: 'snowstorm', chance: { pisoBase: 25, pisoPorDia: 1, teto: 60 } },
      { kind: 'rain', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
      { kind: 'storm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 30 } },
    ],
  },
  // Cinnabar (Fogo): calor (dominante) + tempestade + tempestade de areia.
  6: {
    effects: [
      { kind: 'heat', chance: { pisoBase: 30, pisoPorDia: 1, teto: 65 } },
      { kind: 'storm', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
      { kind: 'sandstorm', chance: { pisoBase: 10, pisoPorDia: 1, teto: 35 } },
    ],
  },
  // Viridian (Terra): tempestade de areia (dominante) + chuva + tempestade + nevasca.
  7: {
    effects: [
      { kind: 'sandstorm', chance: { pisoBase: 25, pisoPorDia: 1, teto: 60 } },
      { kind: 'rain', chance: { pisoBase: 12, pisoPorDia: 1, teto: 40 } },
      { kind: 'storm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 30 } },
      { kind: 'snowstorm', chance: { pisoBase: 8, pisoPorDia: 1, teto: 28 } },
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

/** A cidade tem o efeito de Calor habilitado? */
export function cityHasHeat(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'heat') ?? false
}

/** Fórmula de chance de Calor da cidade, ou null se ela não tem o efeito. */
export function cityHeatChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'heat')
  return e ? e.chance : null
}

/** A cidade tem o efeito de Nevasca habilitado? */
export function cityHasSnow(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'snowstorm') ?? false
}

/** Fórmula de chance de Nevasca da cidade, ou null se ela não tem o efeito. */
export function citySnowChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'snowstorm')
  return e ? e.chance : null
}

/** A cidade tem o efeito de Tempestade de areia habilitado? */
export function cityHasSand(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'sandstorm') ?? false
}

/** Fórmula de chance de Tempestade de areia da cidade, ou null se ela não tem o efeito. */
export function citySandChance(cityIndex: number): WeatherChanceFormula | null {
  const e = getCityWeather(cityIndex)?.effects.find((x) => x.kind === 'sandstorm')
  return e ? e.chance : null
}
