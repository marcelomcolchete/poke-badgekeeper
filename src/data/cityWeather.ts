// Configuração de efeitos climáticos POR CIDADE (extensível). Hoje só Cerulean (índice 1) tem
// clima — Chuva. Cada cidade lista, EM ORDEM, os efeitos que podem aparecer no dia (a previsão
// da manhã os lista nessa ordem). Adicionar um efeito futuro = acrescentar à lista `effects`
// aqui e tratar o `kind` em engine/weather.ts.

/** Tipos de efeito climático conhecidos. Futuro: 'sun' | 'sandstorm' | 'snow' … */
export type WeatherEffectKind = 'rain'

/** Efeito de Chuva: deixa poças pelo mapa (água temporária) — ver engine/weather.ts. */
export interface RainEffectConfig {
  kind: 'rain'
}

export type WeatherEffectConfig = RainEffectConfig

export interface CityWeather {
  /** Efeitos possíveis nesta cidade, na ordem de exibição da previsão. */
  effects: WeatherEffectConfig[]
}

/** cityIndex → clima da cidade. Ausente = cidade sem clima (a maioria, por ora). */
const CITY_WEATHER: Record<number, CityWeather> = {
  // Cerulean (cidade da Água/Gelo): única com clima por enquanto.
  1: { effects: [{ kind: 'rain' }] },
}

/** Clima configurado para a cidade, ou null se ela não tem efeitos climáticos. */
export function getCityWeather(cityIndex: number): CityWeather | null {
  return CITY_WEATHER[cityIndex] ?? null
}

/** A cidade tem o efeito de Chuva habilitado? */
export function cityHasRain(cityIndex: number): boolean {
  return getCityWeather(cityIndex)?.effects.some((e) => e.kind === 'rain') ?? false
}
