import React from 'react'
import { View } from 'react-native'
import { AssistantAvatar } from '../AssistantAvatar'
import type { StreamingBubbleStyles } from './streaming-bubble.styles'

export function StreamingBubbleAvatar({
  emoji,
  avatarPath,
  resolvedAvatarUri,
  styles
}: {
  emoji?: string | null
  avatarPath?: string | null
  resolvedAvatarUri?: string | null
  styles: StreamingBubbleStyles
}) {
  return (
    <View style={styles.avatar}>
      <AssistantAvatar
        emoji={emoji}
        avatarPath={avatarPath}
        resolvedAvatarUri={resolvedAvatarUri}
        size={36}
      />
    </View>
  )
}
