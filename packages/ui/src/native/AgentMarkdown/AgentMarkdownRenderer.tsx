import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { splitStreamingRevealUnits } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
  type MarkdownRendererVariant
} from '../MarkdownRenderer/MarkdownRenderer'
import {
  nativeAgentStreamSegmentMaxChars,
  nativeAgentStreamingFadeMs
} from './agent-markdown.config'

export interface AgentMarkdownRendererProps {
  content: string
  /** 流式进行中：已闭合段落即时 Markdown，尾部未完成片段渐显 */
  isStreaming?: boolean
  variant?: MarkdownRendererVariant
  plainText?: boolean
  style?: MarkdownRendererProps['style']
  resolveImageUri?: MarkdownRendererProps['resolveImageUri']
  loadImageUri?: MarkdownRendererProps['loadImageUri']
  onImagePress?: MarkdownRendererProps['onImagePress']
}

/**
 * 移动端 Agent 专用 Markdown（react-native-markdown-display）。
 * 流式策略对齐桌面 XMarkdown：全文即时累积 + 尾部渐显，无光标。
 */
export const AgentMarkdownRenderer: React.FC<AgentMarkdownRendererProps> = ({
  content,
  isStreaming = false,
  variant = 'chat',
  plainText = false,
  style,
  resolveImageUri,
  loadImageUri,
  onImagePress
}) => {
  const { colors } = useNativeTheme()
  const isAncillary = variant === 'ancillary'

  const { committed, partial } = useMemo(() => {
    if (!isStreaming || !content) {
      return { committed: content, partial: '' }
    }
    const { completeUnits, partialUnit } = splitStreamingRevealUnits(
      content,
      nativeAgentStreamSegmentMaxChars
    )
    return { committed: completeUnits.join(''), partial: partialUnit }
  }, [content, isStreaming])

  if (plainText) {
    return (
      <Text style={[styles.plainText, { color: colors.textPrimary }, style as object]}>
        {content}
      </Text>
    )
  }

  const markdownContent = isStreaming ? committed : content

  return (
    <View style={styles.root}>
      {markdownContent ? (
        <MarkdownRenderer
          content={markdownContent}
          variant={variant}
          style={style}
          resolveImageUri={resolveImageUri}
          loadImageUri={loadImageUri}
          onImagePress={onImagePress}
        />
      ) : null}
      {isStreaming && partial ? (
        <Animated.Text
          key={partial}
          entering={FadeIn.duration(nativeAgentStreamingFadeMs)}
          style={[
            styles.partialTail,
            isAncillary ? styles.partialTailAncillary : null,
            { color: isAncillary ? colors.textSecondary : colors.textPrimary }
          ]}
        >
          {partial}
        </Animated.Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch'
  },
  plainText: {
    fontSize: 14,
    lineHeight: 22
  },
  partialTail: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.65
  },
  partialTailAncillary: {
    fontSize: 14,
    lineHeight: 20
  }
})
