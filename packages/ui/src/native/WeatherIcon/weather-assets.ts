import type { ImageSourcePropType } from 'react-native'
import { normalizeWeatherId, WEATHER_IDS, type WeatherId } from '@baishou/shared'

/** Microsoft Fluent Emoji 3D (MIT) — bundled for offline use */
const FLUENT_WEATHER_ASSETS: Record<WeatherId, ImageSourcePropType> = {
  sunny: require('../../assets/weather/sunny.png'),
  cloudy: require('../../assets/weather/cloudy.png'),
  overcast: require('../../assets/weather/overcast.png'),
  light_rain: require('../../assets/weather/light_rain.png'),
  heavy_rain: require('../../assets/weather/heavy_rain.png'),
  snow: require('../../assets/weather/snow.png'),
  fog: require('../../assets/weather/fog.png'),
  windy: require('../../assets/weather/windy.png')
}

export function getWeatherFluentImageSource(weather?: string | null): ImageSourcePropType | null {
  if (!weather) return null
  const id = normalizeWeatherId(weather)
  if (!(WEATHER_IDS as readonly string[]).includes(id)) return null
  return FLUENT_WEATHER_ASSETS[id as WeatherId]
}
