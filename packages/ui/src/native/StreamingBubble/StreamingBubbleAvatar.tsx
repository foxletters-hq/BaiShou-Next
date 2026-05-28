import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { StreamingBubbleStyles } from './streaming-bubble.styles'

export function StreamingBubbleAvatar({
  emoji,
  styles
}: {
  emoji?: string | null
  styles: StreamingBubbleStyles
}) {
  const { colors } = useNativeTheme()

  return (
    <View style={styles.avatar}>
      {emoji ? (
        <Text style={styles.avatarEmoji}>{emoji}</Text>
      ) : (
        <MaterialIcons name="auto-awesome" size={16} color={colors.textSecondary} />
      )}
    </View>
  )
}
