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
  return WEATHER_ALIASES[value] || value
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
