import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { StreamdownText } from 'react-native-streamdown'
import { useNativeTheme } from '../theme'
import { LegacyMarkdownRenderer } from './LegacyMarkdownRenderer'
import {
  buildStreamdownMarkdownStyle,
  markdownNeedsLegacyImageRenderer,
  prepareNativeStreamdownMarkdown
} from './streamdown-markdown.util'
import { useMarkdownLinkPress } from './useMarkdownLinkPress'

export type MarkdownRendererVariant = 'default' | 'chat' | 'ancillary'

export interface MarkdownRendererProps {
  content: string
  style?: object
  /** chat：气泡正文；ancillary：思考块等附属内容 */
  variant?: MarkdownRendererVariant
  /** 将 attachment/xxx 转为可加载的 file:// URI */
  resolveImageUri?: (src: string) => string | null | undefined
  /** 异步解析 attachment/xxx（Android 外部存储需 data: URI） */
  loadImageUri?: (src: string) => Promise<string | null>
  onImagePress?: (src: string, resolvedUri: string) => void
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  const { content, style, variant = 'default', resolveImageUri, loadImageUri } = props
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

  const displayContent = useMemo(
    () => prepareNativeStreamdownMarkdown(content, resolveImageUri),
    [content, resolveImageUri]
  )

  const streamFlavor = variant === 'ancillary' ? 'commonmark' : 'github'

  if (useLegacy) {
    return <LegacyMarkdownRenderer {...props} />
  }

  if (!displayContent) return null

  return (
    <View
      style={[variant === 'default' ? styles.containerDefault : styles.containerCompact, style]}
    >
      <StreamdownText
        allowTrailingMargin={false}
        flavor={streamFlavor}
        markdown={displayContent}
        markdownStyle={markdownStyle}
        md4cFlags={{ latexMath: true, underline: false }}
        onLinkPress={handleLinkPress}
        selectable
        streamingConfig={{ tableMode: 'progressive' }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  containerDefault: {
    flex: 1
  },
  containerCompact: {
    alignSelf: 'stretch'
  }
})
