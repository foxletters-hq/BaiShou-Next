import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { StreamdownText } from 'react-native-streamdown'
import { EnrichedMarkdownText } from 'react-native-enriched-markdown'
import { useNativeTheme } from '../theme'
import { LegacyMarkdownRenderer } from './LegacyMarkdownRenderer'
import { useStableStreamdownMarkdown } from './useStableStreamdownMarkdown'
import {
  buildStreamdownMarkdownStyle,
  markdownNeedsLegacyImageRenderer,
  prepareNativeStreamdownMarkdown,
  preserveChatTrailingNewlines
} from './streamdown-markdown.util'
import { useMarkdownLinkPress } from './useMarkdownLinkPress'

export type MarkdownRendererVariant = 'default' | 'chat' | 'ancillary'

const STATIC_MD4C_FLAGS = { latexMath: true, underline: false } as const
const STATIC_STREAMING_CONFIG = { tableMode: 'progressive' as const }

function StaticStreamdownText({
  markdown,
  containerStyle,
  ...props
}: React.ComponentProps<typeof EnrichedMarkdownText>) {
  const processedMarkdown = useStableStreamdownMarkdown(markdown)
  return (
    <EnrichedMarkdownText
      markdown={processedMarkdown}
      md4cFlags={STATIC_MD4C_FLAGS}
      streamingConfig={STATIC_STREAMING_CONFIG}
      containerStyle={containerStyle}
      {...props}
    />
  )
}

export interface MarkdownRendererProps {
  content: string
  style?: object
  /** 流式进行中：commonmark + 稳定 selectable，减轻块级重排闪烁 */
  isStreaming?: boolean
  /** chat：气泡正文；ancillary：思考块等附属内容 */
  variant?: MarkdownRendererVariant
  /** 将 attachment/xxx 转为可加载的 file:// URI */
  resolveImageUri?: (src: string) => string | null | undefined
  /** 异步解析 attachment/xxx（Android 外部存储需 data: URI） */
  loadImageUri?: (src: string) => Promise<string | null>
  onImagePress?: (src: string, resolvedUri: string) => void
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  const {
    content,
    style,
    variant = 'default',
    isStreaming = false,
    resolveImageUri,
    loadImageUri
  } = props
  const { colors } = useNativeTheme()
  const { handleLinkPress } = useMarkdownLinkPress()

  const useLegacy = useMemo(
    () => markdownNeedsLegacyImageRenderer(content, resolveImageUri, loadImageUri),
    [content, resolveImageUri, loadImageUri]
  )

  const markdownStyle = useMemo(
    () => buildStreamdownMarkdownStyle(colors, variant),
    [colors, variant]
  )

  const useTrailingMargin = variant === 'chat' || variant === 'ancillary'

  const displayContent = useMemo(() => {
    const prepared = prepareNativeStreamdownMarkdown(content, resolveImageUri)
    return useTrailingMargin ? preserveChatTrailingNewlines(prepared) : prepared
  }, [content, resolveImageUri, useTrailingMargin])

  const streamFlavor =
    variant === 'chat' || isStreaming || variant === 'ancillary' ? 'commonmark' : 'github'
  const markdownContainerStyle =
    variant === 'chat' || variant === 'ancillary'
      ? [styles.containerCompact, style]
      : [variant === 'default' ? styles.containerDefault : styles.containerCompact, style]
  const nativeContainerStyle =
    variant === 'chat'
      ? styles.markdownChatNative
      : variant === 'ancillary'
        ? styles.markdownAncillaryNative
        : styles.markdownFill

  if (useLegacy) {
    return <LegacyMarkdownRenderer {...props} />
  }

  if (!displayContent) return null

  return (
    <View style={markdownContainerStyle}>
      {isStreaming ? (
        <StreamdownText
          allowTrailingMargin={useTrailingMargin}
          flavor={streamFlavor}
          markdown={displayContent}
          markdownStyle={markdownStyle}
          md4cFlags={STATIC_MD4C_FLAGS}
          onLinkPress={handleLinkPress}
          selectable
          containerStyle={nativeContainerStyle}
          streamingConfig={{ tableMode: 'hidden' }}
        />
      ) : (
        <StaticStreamdownText
          allowTrailingMargin={useTrailingMargin}
          flavor={streamFlavor}
          markdown={displayContent}
          markdownStyle={markdownStyle}
          onLinkPress={handleLinkPress}
          selectable
          containerStyle={nativeContainerStyle}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  containerDefault: {
    flex: 1
  },
  containerCompact: {
    alignSelf: 'stretch',
    width: '100%'
  },
  markdownFill: {
    alignSelf: 'stretch',
    width: '100%'
  },
  /** 聊天气泡：allowTrailingMargin + 槽位 guard 双保险 */
  markdownChatNative: {
    alignSelf: 'stretch',
    width: '100%'
  },
  markdownAncillaryNative: {
    alignSelf: 'stretch',
    width: '100%'
  }
})
