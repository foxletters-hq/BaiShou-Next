import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { isCustomUserAvatar, resolveNativeUserAvatarSource } from '../user-avatar.util'
import {
  resolveNativeAssistantAvatarSource,
  shouldShowAssistantEmoji
} from '../assistant-avatar.util'

interface ChatBubbleAvatarProps {
  emoji?: string | null
  avatarPath?: string | null
  resolvedAvatarUri?: string | null
  nickname?: string
  variant: 'user' | 'assistant'
  style?: object
}

export const ChatBubbleAvatar: React.FC<ChatBubbleAvatarProps> = ({
  emoji,
  avatarPath,
  resolvedAvatarUri,
  nickname,
  variant,
  style
}) => {
  const { colors } = useNativeTheme()

  return (
    <View style={[styles.avatar, { backgroundColor: colors.bgSurfaceHighest }, style]}>
      {variant === 'user' ? (
        <Image
          key={`user-${avatarPath ?? ''}-${resolvedAvatarUri ?? ''}`}
          source={resolveNativeUserAvatarSource(avatarPath, resolvedAvatarUri)}
          style={styles.avatarImage}
        />
      ) : shouldShowAssistantEmoji(avatarPath, resolvedAvatarUri, emoji) ? (
        <Text style={styles.avatarText}>{emoji}</Text>
      ) : (
        <Image
          key={`assistant-${avatarPath ?? ''}-${resolvedAvatarUri ?? ''}`}
          source={resolveNativeAssistantAvatarSource(avatarPath, resolvedAvatarUri)}
          style={styles.avatarImage}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4
  },
  avatarImage: {
    width: 32,
    height: 32
  },
  avatarText: {
    fontSize: 16
  }
})
