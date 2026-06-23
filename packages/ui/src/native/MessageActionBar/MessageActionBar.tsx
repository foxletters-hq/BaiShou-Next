import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NativeIconButton } from '../icons/NativeIconButton'
import { useNativeTheme } from '../theme'
import {
  chatOverBackgroundMetaIconColor,
  chatOverBackgroundMetaIconStyle
} from '../../shared/chat-over-background-meta.style'

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
  /** 自定义聊天背景上为操作图标启用反色混合 */
  invertOverBackground?: boolean
  /** 聊天气泡操作栏使用更大触控区域 */
  comfortableTouch?: boolean
  /** 重试/重新发送处理中或流式生成未完成时禁用 */
  retryDisabled?: boolean
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
  isTtsPlaying = false,
  invertOverBackground = false,
  comfortableTouch = false,
  retryDisabled = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [copied, setCopied] = useState(false)
  const iconSize = comfortableTouch ? 16 : 14
  const iconButtonStyle = comfortableTouch ? styles.comfortableIconButton : undefined
  const contextBtnStyle = comfortableTouch ? styles.comfortableContextBtn : styles.contextBtn
  const contextIconStyle = comfortableTouch ? styles.comfortableContextIcon : styles.contextIcon

  const invertIconProps = (skipInvert = false) =>
    invertOverBackground && !skipInvert
      ? { color: chatOverBackgroundMetaIconColor, style: chatOverBackgroundMetaIconStyle }
      : {}

  const handleCopy = useCallback(() => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy])

  const handleRetry = useCallback(() => {
    if (!onRetry || retryDisabled) return
    onRetry()
  }, [onRetry, retryDisabled])

  return (
    <View
      style={[
        styles.container,
        comfortableTouch && styles.comfortableContainer,
        isAI ? styles.alignLeft : styles.alignRight
      ]}
    >
      <NativeIconButton
        name={copied ? 'check' : 'content-copy'}
        onPress={handleCopy}
        size={iconSize}
        style={iconButtonStyle}
        color={copied ? colors.success : undefined}
        accessibilityLabel={t('agent.chat.copy', '复制内容')}
        {...invertIconProps(copied)}
      />

      {isAI && onReadAloud && (
        <NativeIconButton
          name="volume-up"
          onPress={onReadAloud}
          size={iconSize}
          style={iconButtonStyle}
          active={isTtsPlaying}
          loading={isTtsPlaying}
          accessibilityLabel={t('agent.chat.readAloud', '语音朗读')}
          {...invertIconProps(isTtsPlaying)}
        />
      )}

      {onEdit && (
        <NativeIconButton
          name="edit"
          onPress={onEdit}
          size={iconSize}
          style={iconButtonStyle}
          accessibilityLabel={t(
            isAI ? 'agent.chat.edit_ai' : 'agent.chat.edit',
            isAI ? '编辑AI回复' : '编辑我的消息'
          )}
          {...invertIconProps()}
        />
      )}

      {onRetry && (
        <NativeIconButton
          name="refresh"
          onPress={handleRetry}
          size={iconSize}
          style={iconButtonStyle}
          disabled={retryDisabled}
          accessibilityLabel={t('agent.chat.retry', '重新发送/生成')}
          {...invertIconProps()}
        />
      )}

      {isAI && onBranch && (
        <NativeIconButton
          name="call-split"
          onPress={onBranch}
          size={iconSize}
          style={iconButtonStyle}
          accessibilityLabel={t('agent.chat.branch', '从此处创建分支')}
          {...invertIconProps()}
        />
      )}

      {onShowContext && (
        <TouchableOpacity
          onPress={onShowContext}
          style={contextBtnStyle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('chat.viewContextTree', '查看发送给 AI 的上下文')}
        >
          <Text style={contextIconStyle}>🌿</Text>
        </TouchableOpacity>
      )}

      {onDelete && (
        <NativeIconButton
          name="delete-outline"
          onPress={onDelete}
          size={iconSize}
          style={iconButtonStyle}
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
  comfortableContainer: {
    gap: 6,
    paddingTop: 5
  },
  comfortableIconButton: {
    width: 30,
    height: 30,
    borderRadius: 7
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
  comfortableContextBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contextIcon: {
    fontSize: 14
  },
  comfortableContextIcon: {
    fontSize: 16
  }
})
