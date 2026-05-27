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

/** Legacy Chinese values (and aliases) → canonical id */
export const WEATHER_LEGACY_TO_ID: Record<string, WeatherId> = {
  晴: 'sunny',
  多云: 'cloudy',
  阴: 'overcast',
  小雨: 'light_rain',
  大雨: 'heavy_rain',
  雪: 'snow',
  雾: 'fog',
  风: 'windy',
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
  return WEATHER_LEGACY_TO_ID[value] || value
}

/** i18n key suffix under diary.weather.* */
export function weatherI18nKey(id: WeatherId): string {
  return I18N_KEY_BY_ID[id]
}

/** All values that should match a filter chip (canonical + legacy labels). */
export function expandWeatherFilterValues(filterIds: string[]): string[] {
  const expanded = new Set<string>()
  for (const id of filterIds) {
    const canonical = normalizeWeatherId(id) as WeatherId
    expanded.add(id)
    if ((WEATHER_IDS as readonly string[]).includes(canonical)) {
      expanded.add(canonical)
      for (const [legacy, mapped] of Object.entries(WEATHER_LEGACY_TO_ID)) {
        if (mapped === canonical) expanded.add(legacy)
      }
    }
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
