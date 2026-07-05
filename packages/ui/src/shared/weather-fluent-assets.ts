import { resolveWeatherId, type WeatherId } from '@baishou/shared'
import sunnyIcon from '../assets/weather/sunny.png'
import cloudyIcon from '../assets/weather/cloudy.png'
import overcastIcon from '../assets/weather/overcast.png'
import lightRainIcon from '../assets/weather/light_rain.png'
import heavyRainIcon from '../assets/weather/heavy_rain.png'
import snowIcon from '../assets/weather/snow.png'
import fogIcon from '../assets/weather/fog.png'
import windyIcon from '../assets/weather/windy.png'

/** Microsoft Fluent Emoji 3D (MIT) — desktop / web bundler URLs */
export const WEATHER_FLUENT_ICON_SRC: Record<WeatherId, string> = {
  sunny: sunnyIcon,
  cloudy: cloudyIcon,
  overcast: overcastIcon,
  light_rain: lightRainIcon,
  heavy_rain: heavyRainIcon,
  snow: snowIcon,
  fog: fogIcon,
  windy: windyIcon
}

export function getWeatherFluentIconSrc(weather?: string | null): string | null {
  const id = resolveWeatherId(weather)
  if (!id) return null
  return WEATHER_FLUENT_ICON_SRC[id]
}
