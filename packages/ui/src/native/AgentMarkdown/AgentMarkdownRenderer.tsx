import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
  type MarkdownRendererVariant
} from '../MarkdownRenderer/MarkdownRenderer'
import { FluidAgentMarkdownRenderer } from './FluidAgentMarkdownRenderer'

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：稳定块 Markdown + 当前块 printer */
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
 * 流式期间：稳定块走 MarkdownRenderer，当前块走 FluidAgentMarkdownRenderer printer；结束后完整 Markdown 解析。
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

  if (plainText) {
    return (
      <Text style={[styles.plainText, { color: colors.textPrimary }, style as object]}>
        {content}
      </Text>
    )
  }

  if (isStreaming) {
    return (
      <FluidAgentMarkdownRenderer
        content={content}
        variant={variant}
        isStreaming
        style={style}
        resolveImageUri={resolveImageUri}
        loadImageUri={loadImageUri}
        onImagePress={onImagePress}
      />
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
