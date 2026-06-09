import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import {
  resolveNativeAssistantAvatarSource,
  shouldShowAssistantEmoji
} from '../assistant-avatar.util'

export interface AssistantAvatarProps {
  emoji?: string | null
  avatarPath?: string | null
  /** 相对路径 avatars/… 经 AttachmentManager 解析后的本地 URI */
  resolvedAvatarUri?: string | null
  size?: number
}

export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  emoji,
  avatarPath,
  resolvedAvatarUri,
  size = 40
}) => {
  const { colors } = useNativeTheme()
  const radius = size / 2
  const showEmoji = shouldShowAssistantEmoji(avatarPath, resolvedAvatarUri, emoji)

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.bgSurfaceHighest
        }
      ]}
    >
      {showEmoji && emoji ? (
        <Text style={[styles.emoji, { fontSize: size * 0.45 }]}>{emoji}</Text>
      ) : (
        <Image
          source={resolveNativeAssistantAvatarSource(avatarPath, resolvedAvatarUri)}
          style={{ width: size, height: size, borderRadius: radius }}
          resizeMode="cover"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  emoji: {
    textAlign: 'center'
  }
})
