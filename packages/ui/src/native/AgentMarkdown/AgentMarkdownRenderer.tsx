import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
  type MarkdownRendererVariant
} from '../MarkdownRenderer/MarkdownRenderer'

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：由 Streamdown 原生 streamingAnimation 处理渐显 */
  isStreaming?: boolean
  variant?: MarkdownRendererVariant
  plainText?: boolean
  style?: MarkdownRendererProps['style']
  resolveImageUri?: MarkdownRendererProps['resolveImageUri']
  loadImageUri?: MarkdownRendererProps['loadImageUri']
  onImagePress?: MarkdownRendererProps['onImagePress']
}

/**
 * 移动端 Agent Markdown。
 * 流式与历史消息统一走 Streamdown（react-native-streamdown + enriched-markdown 原生渐显）。
 */
export const AgentMarkdownRenderer = React.memo(function AgentMarkdownRenderer({
  content,
  isStreaming: _isStreaming = false,
  variant = 'chat',
  plainText = false,
  style,
  resolveImageUri,
  loadImageUri,
  onImagePress
}: AgentMarkdownRendererProps) {
  const { colors } = useNativeTheme()

  if (plainText) {
    return (
      <Text style={[styles.plainText, { color: colors.textPrimary }, style as object]}>
        {content}
      </Text>
    )
  }

  if (!content) return null

  return (
    <View style={styles.root}>
      <MarkdownRenderer
        content={content}
        variant={variant}
        style={style}
        resolveImageUri={resolveImageUri}
        loadImageUri={loadImageUri}
        onImagePress={onImagePress}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch'
  },
  plainText: {
    fontSize: 14,
    lineHeight: 22
  }
})
