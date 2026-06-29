import React from 'react'
import {
  Image,
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ImageStyle
} from 'react-native'
import { getMoodEmoji, normalizeMoodId, MOOD_IDS } from '@baishou/shared'
import { getMoodFluentImageSource } from './mood-assets'

export interface MoodEmojiProps {
  mood: string
  size?: number
  style?: StyleProp<ImageStyle | TextStyle>
  textStyle?: StyleProp<TextStyle>
}

/** Fluent Emoji 3D 离线图标，未知心情回退系统 emoji */
export const MoodEmoji: React.FC<MoodEmojiProps> = ({ mood, size = 18, style, textStyle }) => {
  const id = normalizeMoodId(mood)
  const source = getMoodFluentImageSource(id)
  const fallback = getMoodEmoji(id)

  if (!id || !(MOOD_IDS as readonly string[]).includes(id)) {
    return null
  }

  if (!source) {
    return (
      <Text
        style={[
          styles.fallback,
          { fontSize: size * 0.85, lineHeight: size, width: size, height: size },
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

const styles = StyleSheet.create({
  fallback: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center'
  }
})
