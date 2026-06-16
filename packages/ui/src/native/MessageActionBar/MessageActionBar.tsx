import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NativeIconButton } from '../icons/NativeIconButton'
import { useNativeTheme } from '../theme'

export interface MessageActionBarProps {
  onCopy: () => void
  onRetry?: () => void
  onEdit?: () => void
  onReadAloud?: () => void
  onDelete?: () => void
  onBranch?: () => void
  onShowContext?: () => void
  isAI?: boolean
  isTtsPlaying?: boolean
}

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  onCopy,
  onRetry,
  onEdit,
  onReadAloud,
  onDelete,
  onBranch,
  onShowContext,
  isAI = false,
  isTtsPlaying = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  return (
    <View style={[styles.container, isAI ? styles.alignLeft : styles.alignRight]}>
      <NativeIconButton
        name={copied ? 'check' : 'content-copy'}
        onPress={handleCopy}
        color={copied ? colors.success : undefined}
        accessibilityLabel={t('agent.chat.copy', '复制内容')}
      />

      {isAI && onReadAloud && (
        <NativeIconButton
          name="volume-up"
          onPress={onReadAloud}
          active={isTtsPlaying}
          loading={isTtsPlaying}
          accessibilityLabel={t('agent.chat.readAloud', '语音朗读')}
        />
      )}

      {onEdit && (
        <NativeIconButton
          name="edit"
          onPress={onEdit}
          accessibilityLabel={t(
            isAI ? 'agent.chat.edit_ai' : 'agent.chat.edit',
            isAI ? '编辑AI回复' : '编辑我的消息'
          )}
        />
      )}

      {onRetry && (
        <NativeIconButton
          name="refresh"
          onPress={onRetry}
          accessibilityLabel={t('agent.chat.retry', '重新发送/生成')}
        />
      )}

      {isAI && onBranch && (
        <NativeIconButton
          name="call-split"
          onPress={onBranch}
          accessibilityLabel={t('agent.chat.branch', '从此处创建分支')}
        />
      )}

      {onShowContext && (
        <TouchableOpacity
          onPress={onShowContext}
          style={styles.contextBtn}
          accessibilityRole="button"
          accessibilityLabel={t('chat.viewContextTree', '查看发送给 AI 的上下文')}
        >
          <Text style={styles.contextIcon}>🌿</Text>
        </TouchableOpacity>
      )}

      {onDelete && (
        <NativeIconButton
          name="delete-outline"
          onPress={onDelete}
          danger
          accessibilityLabel={t('common.delete', '删除此条气泡')}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4
  },
  alignLeft: {
    justifyContent: 'flex-start'
  },
  alignRight: {
    justifyContent: 'flex-end'
  },
  contextBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contextIcon: {
    fontSize: 14
  }
})
