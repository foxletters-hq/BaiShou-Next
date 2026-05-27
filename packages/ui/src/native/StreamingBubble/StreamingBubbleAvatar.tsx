import React from 'react'
import { View, Text } from 'react-native'
import type { StreamingBubbleStyles } from './streaming-bubble.styles'

export function StreamingBubbleAvatar({
  emoji,
  styles
}: {
  emoji?: string | null
  styles: StreamingBubbleStyles
}) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarEmoji}>{emoji || '✨'}</Text>
    </View>
  )
}
