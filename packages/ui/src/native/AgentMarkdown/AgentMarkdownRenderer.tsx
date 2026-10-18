import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import { mobileTypography } from '../../theme/tokens'
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
  type MarkdownRendererVariant
} from '../MarkdownRenderer/MarkdownRenderer'
import { useAgentStreamingReveal } from './useAgentStreamingReveal'

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：启用缓冲渐进揭示与 Gemini 风格尾部渐变 */
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
 * 流式期间按平滑节奏从缓冲释放文本，并对最新浮现的尾部文字施加 Gemini 风格透明度渐变。
 */
export const AgentMarkdownRenderer = React.memo(function AgentMarkdownRenderer({
  content,
  isStreaming = false,
  variant = 'chat',
  plainText = false,
  style,
  resolveImageUri,
  loadImageUri,
  onImagePress
}: AgentMarkdownRendererProps) {
  const { colors } = useNativeTheme()
  const { displayContent, streamingTailFadeChars } = useAgentStreamingReveal(content, isStreaming)

  if (plainText) {
    return (
      <Text style={[styles.plainText, { color: colors.textPrimary }, style as object]}>
        {content}
      </Text>
    )
  }

  if (!displayContent) return null

  return (
    <View style={styles.root}>
      <MarkdownRenderer
        content={displayContent}
        isStreaming={isStreaming}
        streamingTailFadeChars={streamingTailFadeChars}
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
    alignSelf: 'stretch',
    width: '100%'
  },
  plainText: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 22
  }
})
