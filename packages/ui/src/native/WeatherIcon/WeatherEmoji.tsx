import React from 'react'
import {
  Image,
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ImageStyle
} from 'react-native'
import { getWeatherEmoji, normalizeWeatherId, type WeatherId, WEATHER_IDS } from '@baishou/shared'
import { getWeatherFluentImageSource } from './weather-assets'

export interface WeatherEmojiProps {
  weather: string
  size?: number
  style?: StyleProp<ImageStyle | TextStyle>
  textStyle?: StyleProp<TextStyle>
}

/** Fluent Emoji 3D 离线图标，未知天气回退系统 emoji */
export const WeatherEmoji: React.FC<WeatherEmojiProps> = ({
  weather,
  size = 20,
  style,
  textStyle
}) => {
  const id = normalizeWeatherId(weather)
  const source = getWeatherFluentImageSource(id)
  const fallback = getWeatherEmoji(id)

  if (!source) {
    return (
      <Text
        style={[
          styles.fallback,
          { fontSize: size * 0.9, lineHeight: size },
          textStyle,
          style as TextStyle
        ]}
      >
        {fallback}
      </Text>
    )
  }

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style as ImageStyle]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  )
}

export function isKnownWeatherId(weather: string): weather is WeatherId {
  const id = normalizeWeatherId(weather)
  return (WEATHER_IDS as readonly string[]).includes(id)
}

const styles = StyleSheet.create({
  fallback: {
    textAlign: 'center'
  }
})
