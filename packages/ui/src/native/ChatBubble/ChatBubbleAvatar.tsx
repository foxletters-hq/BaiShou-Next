import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { isCustomUserAvatar, resolveNativeUserAvatarSource } from '../user-avatar.util'

interface ChatBubbleAvatarProps {
  emoji?: string | null
  avatarPath?: string | null
  nickname?: string
  variant: 'user' | 'assistant'
  style?: object
}

export const ChatBubbleAvatar: React.FC<ChatBubbleAvatarProps> = ({
  emoji,
  avatarPath,
  nickname,
  variant,
  style
}) => {
  const { colors } = useNativeTheme()

  return (
    <View style={[styles.avatar, { backgroundColor: colors.bgSurfaceHighest }, style]}>
      {variant === 'user' ? (
        <Image source={resolveNativeUserAvatarSource(avatarPath)} style={styles.avatarImage} />
      ) : isCustomUserAvatar(avatarPath) ? (
        <Image source={{ uri: avatarPath! }} style={styles.avatarImage} />
      ) : emoji ? (
        <Text style={styles.avatarText}>{emoji}</Text>
      ) : (
        <MaterialIcons name="auto-awesome" size={16} color={colors.textSecondary} />
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
