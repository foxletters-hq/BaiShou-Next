import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'

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
      {avatarPath ? (
        <Image source={{ uri: avatarPath }} style={styles.avatarImage} />
      ) : emoji ? (
        <Text style={styles.avatarText}>{emoji}</Text>
      ) : variant === 'user' ? (
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {(nickname || 'U').charAt(0).toUpperCase()}
        </Text>
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
