import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface MessageActionBarProps {
  onCopy: () => void
  onRetry?: () => void
  onEdit?: () => void
  onReadAloud?: () => void
  onDelete?: () => void
  onBranch?: () => void
  isAI?: boolean
  isTtsPlaying?: boolean
}

const ACTION_CONFIG: Array<{
  key: string
  emoji: string
  label: string
  show: (isAI: boolean) => boolean
  isDestructive?: boolean
}> = [
  { key: 'copy', emoji: '📋', label: '复制', show: () => true },
  { key: 'readAloud', emoji: '🔊', label: '朗读', show: (isAI) => isAI },
  { key: 'edit', emoji: '✏️', label: '编辑', show: () => true },
  { key: 'retry', emoji: '🔄', label: '重试', show: () => true },
  { key: 'branch', emoji: '🌿', label: '分支', show: (isAI) => isAI },
  { key: 'delete', emoji: '🗑️', label: '删除', show: () => true, isDestructive: true }
]

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  onCopy,
  onRetry,
  onEdit,
  onReadAloud,
  onDelete,
  onBranch,
  isAI = false,
  isTtsPlaying = false
}) => {
  const { colors, tokens } = useNativeTheme()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  const getHandler = (key: string): (() => void) | undefined => {
    switch (key) {
      case 'copy': return handleCopy
      case 'readAloud': return onReadAloud
      case 'edit': return onEdit
      case 'retry': return onRetry
      case 'branch': return onBranch
      case 'delete': return onDelete
      default: return undefined
    }
  }

  const visibleActions = ACTION_CONFIG.filter((action) => {
    if (action.key === 'readAloud' && !onReadAloud) return false
    if (action.key === 'edit' && !onEdit) return false
    if (action.key === 'retry' && !onRetry) return false
    if (action.key === 'delete' && !onDelete) return false
    if (action.key === 'branch' && !onBranch) return false
    return action.show(isAI)
  })

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      {visibleActions.map((action) => {
        const handler = getHandler(action.key)
        const isCopied = action.key === 'copy' && copied
        const isTtsActive = action.key === 'readAloud' && isTtsPlaying

        return (
          <TouchableOpacity
            key={action.key}
            style={[
              styles.actionButton,
              {
                backgroundColor: isTtsActive
                  ? colors.primaryLight
                  : 'transparent'
              }
            ]}
            onPress={handler}
            disabled={!handler}
            activeOpacity={0.6}
          >
            <Text style={styles.actionEmoji}>
              {isCopied ? '✓' : action.emoji}
            </Text>
            <Text
              style={[
                styles.actionLabel,
                {
                  color: action.isDestructive
                    ? colors.error
                    : isCopied
                      ? colors.success
                      : colors.textSecondary
                }
              ]}
            >
              {isCopied ? '已复制' : action.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  actionEmoji: {
    fontSize: 18
  },
  actionLabel: {
    fontSize: 10,
    marginTop: 2
  }
})
