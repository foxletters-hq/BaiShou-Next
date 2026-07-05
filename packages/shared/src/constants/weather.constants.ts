/** Canonical weather IDs stored in DB / used for filters */
export const WEATHER_IDS = [
  'sunny',
  'cloudy',
  'overcast',
  'light_rain',
  'heavy_rain',
  'snow',
  'fog',
  'windy'
] as const

export type WeatherId = (typeof WEATHER_IDS)[number]

/** English aliases → canonical id */
const WEATHER_ALIASES: Record<string, WeatherId> = {
  wind: 'windy'
}

/** Legacy / demo Chinese labels → canonical id */
const WEATHER_LABEL_TO_ID: Record<string, WeatherId> = {
  晴: 'sunny',
  多云: 'cloudy',
  阴: 'overcast',
  小雨: 'light_rain',
  大雨: 'heavy_rain',
  雪: 'snow',
  雾: 'fog',
  风: 'windy',
  微风: 'windy',
  晴转多云: 'cloudy'
}

const I18N_KEY_BY_ID: Record<WeatherId, string> = {
  sunny: 'sunny',
  cloudy: 'cloudy',
  overcast: 'overcast',
  light_rain: 'light_rain',
  heavy_rain: 'heavy_rain',
  snow: 'snow',
  fog: 'fog',
  windy: 'windy'
}

/** Normalize stored weather to canonical id (or passthrough unknown). */
export function normalizeWeatherId(value?: string | null): string {
  if (!value) return ''
  if ((WEATHER_IDS as readonly string[]).includes(value)) return value
  const alias = WEATHER_ALIASES[value]
  if (alias) return alias
  const fromLabel = WEATHER_LABEL_TO_ID[value]
  if (fromLabel) return fromLabel
  return value
}

/** Resolve to canonical WeatherId, or null when unknown. */
export function resolveWeatherId(value?: string | null): WeatherId | null {
  const id = normalizeWeatherId(value)
  if (!id || !(WEATHER_IDS as readonly string[]).includes(id)) return null
  return id as WeatherId
}

/** i18n key suffix under diary.weather.* */
export function weatherI18nKey(id: WeatherId): string {
  return I18N_KEY_BY_ID[id]
}

/** All values that should match a filter chip (canonical ids). */
export function expandWeatherFilterValues(filterIds: string[]): string[] {
  const expanded = new Set<string>()
  for (const id of filterIds) {
    expanded.add(id)
    const canonical = normalizeWeatherId(id)
    if (canonical) expanded.add(canonical)
  }
  return [...expanded]
}

export function weatherMatchesFilter(
  storedWeather: string | undefined | null,
  filterIds: string[]
): boolean {
  if (filterIds.length === 0) return true
  if (!storedWeather) return false
  const expanded = expandWeatherFilterValues(filterIds)
  const normalized = normalizeWeatherId(storedWeather)
  return expanded.includes(storedWeather) || expanded.includes(normalized)
}
