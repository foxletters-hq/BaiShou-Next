import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { StreamdownText } from 'react-native-streamdown'
import { EnrichedMarkdownText } from 'react-native-enriched-markdown'
import { useNativeTheme } from '../theme'
import { LegacyMarkdownRenderer } from './LegacyMarkdownRenderer'
import { StableStreamdownText } from './StableStreamdownText'
import { ChatMarkdownHeightGuard } from './ChatMarkdownHeightGuard'
import { useStableStreamdownMarkdown } from './useStableStreamdownMarkdown'
import {
  buildStreamdownMarkdownStyle,
  markdownNeedsLegacyImageRenderer,
  prepareNativeStreamdownMarkdown,
  preserveChatDisplayNewlines
} from './streamdown-markdown.util'
import { useMarkdownLinkPress } from './useMarkdownLinkPress'

export type MarkdownRendererVariant = 'default' | 'chat' | 'ancillary' | 'preview'

const STATIC_MD4C_FLAGS = { latexMath: true, underline: false } as const
const STATIC_STREAMING_CONFIG = { tableMode: 'progressive' as const }

function StaticStreamdownText({
  markdown,
  containerStyle,
  preferSyncRemend = false,
  ...props
}: React.ComponentProps<typeof EnrichedMarkdownText> & {
  preferSyncRemend?: boolean
}) {
  const processedMarkdown = useStableStreamdownMarkdown(markdown, undefined, { preferSyncRemend })
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
    const isChatLike = variant === 'chat' || variant === 'ancillary'
    const prepared = prepareNativeStreamdownMarkdown(content, resolveImageUri, {
      chat: isChatLike
    })
    return useTrailingMargin ? preserveChatDisplayNewlines(prepared) : prepared
  }, [content, resolveImageUri, useTrailingMargin, variant])

  const streamFlavor: 'github' | 'commonmark' =
    variant === 'chat' || isStreaming || variant === 'ancillary' ? 'commonmark' : 'github'
  const markdownContainerStyle =
    variant === 'preview'
      ? [styles.containerPreview, style]
      : variant === 'chat' || variant === 'ancillary'
        ? [styles.containerCompact, style]
        : [variant === 'default' ? styles.containerDefault : styles.containerCompact, style]
  const nativeContainerStyle =
    variant === 'preview'
      ? styles.markdownPreviewNative
      : variant === 'chat'
        ? styles.markdownChatNative
        : variant === 'ancillary'
          ? styles.markdownAncillaryNative
          : styles.markdownFill

  if (useLegacy) {
    return <LegacyMarkdownRenderer {...props} content={displayContent} />
  }

  if (!displayContent) return null

  const useLegacyChatLayout =
    (variant === 'chat' || variant === 'ancillary') && !isStreaming

  if (useLegacyChatLayout) {
    return <LegacyMarkdownRenderer {...props} content={displayContent} />
  }

  const streamdownCommonProps = {
    allowTrailingMargin: useTrailingMargin,
    flavor: streamFlavor,
    markdown: displayContent,
    markdownStyle,
    md4cFlags: STATIC_MD4C_FLAGS,
    onLinkPress: handleLinkPress,
    selectable: variant !== 'preview',
    containerStyle: nativeContainerStyle
  }

  // chat / ancillary 流式：EnrichedMarkdownText + 高度兜底
  if (variant === 'chat' || variant === 'ancillary') {
    return (
      <View style={markdownContainerStyle}>
        <ChatMarkdownHeightGuard markdown={displayContent}>
          <StableStreamdownText
            {...streamdownCommonProps}
            hideTablesWhileStreaming={isStreaming}
            streamingAnimation={isStreaming}
            remendConfig={{ inlineCode: false }}
          />
        </ChatMarkdownHeightGuard>
      </View>
    )
  }

  return (
    <View style={markdownContainerStyle}>
      {isStreaming ? (
        <StreamdownText {...streamdownCommonProps} streamingConfig={{ tableMode: 'hidden' }} />
      ) : (
        <StaticStreamdownText
          {...streamdownCommonProps}
          preferSyncRemend={variant === 'preview'}
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
  containerPreview: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden'
  },
  markdownFill: {
    alignSelf: 'stretch',
    width: '100%'
  },
  markdownPreviewNative: {
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
