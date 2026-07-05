import React from 'react'
import { getWeatherEmoji, resolveWeatherId } from '@baishou/shared'
import { getWeatherFluentIconSrc } from '../../shared/weather-fluent-assets'

export interface WeatherEmojiProps {
  weather: string
  size?: number
  className?: string
}

/** Fluent Emoji 3D 离线图标，未知天气回退系统 emoji */
export const WeatherEmoji: React.FC<WeatherEmojiProps> = ({ weather, size = 18, className }) => {
  const id = resolveWeatherId(weather)
  if (!id) return null

  const src = getWeatherFluentIconSrc(id)
  const fallback = getWeatherEmoji(id)

  if (!src) {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.85, lineHeight: `${size}px`, width: size, height: size }}
        aria-hidden
      >
        {fallback}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  )
}
