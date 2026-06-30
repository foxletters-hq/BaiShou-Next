import type { MarkdownStyle } from 'react-native-enriched-markdown'
import {
  parseImageSrcWithoutWidth,
  stripImageWidthInMarkdown
} from '../DiaryEditor/diary-image-markdown.util'
import type { useNativeTheme } from '../theme'

export type StreamdownMarkdownVariant = 'default' | 'chat' | 'ancillary'

const IMAGE_IN_MARKDOWN_RE = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/g

function isDisplayableImageUri(uri: string): boolean {
  return (
    uri.startsWith('data:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://')
  )
}

export function buildStreamdownMarkdownStyle(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  variant: StreamdownMarkdownVariant
): MarkdownStyle {
  const isAncillary = variant === 'ancillary'
  const isChat = variant === 'chat' || isAncillary
  const bodyFontSize = isAncillary ? 14 : 15
  const bodyLineHeight = isAncillary ? 20 : 24
  const bodyColor = isAncillary ? colors.textSecondary : colors.textPrimary
  /** 末行由 CHAT_MARKDOWN_BOTTOM_GUARD 托底，段落间距改由 lineHeight 自然分隔 */
  const paragraphMargin = isAncillary ? 4 : isChat ? 0 : 8
  const headingScale = isChat ? 0.85 : 1
  const codeFontSize = isAncillary ? 12 : 13

  return {
    paragraph: {
      color: bodyColor,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight,
      marginBottom: paragraphMargin
    },
    h1: {
      color: colors.textPrimary,
      fontSize: Math.round(24 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 12 : 16,
      marginBottom: isChat ? 6 : 8
    },
    h2: {
      color: colors.textPrimary,
      fontSize: Math.round(20 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 10 : 14,
      marginBottom: isChat ? 4 : 6
    },
    h3: {
      color: colors.textPrimary,
      fontSize: Math.round(18 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 8 : 12,
      marginBottom: 4
    },
    h4: {
      color: colors.textPrimary,
      fontSize: Math.round(17 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 8 : 10,
      marginBottom: 4
    },
    h5: {
      color: colors.textPrimary,
      fontSize: Math.round(16 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 6 : 8,
      marginBottom: 4
    },
    h6: {
      color: colors.textSecondary,
      fontSize: Math.round(15 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 4 : 6,
      marginBottom: 4
    },
    blockquote: {
      color: bodyColor,
      borderColor: colors.primary,
      backgroundColor: colors.bgSurfaceHighest,
      marginBottom: paragraphMargin
    },
    list: {
      color: bodyColor,
      bulletColor: bodyColor,
      markerColor: bodyColor,
      marginBottom: isChat ? 6 : 8
    },
    code: {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurfaceHighest,
      borderColor: colors.borderSubtle,
      fontSize: codeFontSize,
      fontFamily: 'monospace'
    },
    codeBlock: {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurfaceHighest,
      borderColor: colors.borderSubtle,
      borderRadius: 8,
      padding: 10,
      marginBottom: paragraphMargin,
      fontSize: codeFontSize,
      fontFamily: 'monospace'
    },
    link: {
      color: colors.primary,
      underline: false
    },
    strong: { color: colors.textPrimary },
    em: { color: bodyColor },
    strikethrough: { color: colors.textSecondary },
    underline: { color: bodyColor },
    thematicBreak: {
      color: colors.borderSubtle,
      marginTop: isChat ? 10 : 16,
      marginBottom: isChat ? 10 : 16
    },
    table: {
      color: bodyColor,
      headerTextColor: colors.textPrimary,
      headerBackgroundColor: colors.bgSurfaceHighest,
      rowEvenBackgroundColor: colors.bgSurface,
      rowOddBackgroundColor: colors.bgSurface,
      borderColor: colors.borderSubtle,
      marginBottom: paragraphMargin
    },
    taskList: {
      checkedColor: colors.primary,
      borderColor: colors.borderSubtle,
      checkmarkColor: colors.textPrimary,
      checkedTextColor: colors.textSecondary
    },
    math: {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurfaceHighest
    },
    inlineMath: { color: colors.textPrimary }
  }
}

/** 剥离零宽字符与日记宽度语法，并将可同步解析的 attachment 图片写回可加载 URI */
export function prepareNativeStreamdownMarkdown(
  content: string,
  resolveImageUri?: (src: string) => string | null | undefined
): string {
  let text = stripImageWidthInMarkdown(content.replace(/\u200B/g, ''))
  if (!resolveImageUri) return text

  text = text.replace(IMAGE_IN_MARKDOWN_RE, (match, alt: string, rawSrc: string) => {
    const src = parseImageSrcWithoutWidth(rawSrc)
    const resolved = resolveImageUri(src)
    if (resolved && isDisplayableImageUri(resolved)) {
      return `![${alt}](${resolved})`
    }
    return match
  })

  return text
}

/** 含需异步 loadImageUri 的 attachment 图片时，回退旧 markdown-display 渲染器 */
export function markdownNeedsLegacyImageRenderer(
  content: string,
  resolveImageUri?: (src: string) => string | null | undefined,
  loadImageUri?: (src: string) => Promise<string | null>
): boolean {
  if (!loadImageUri) return false

  const text = stripImageWidthInMarkdown(content.replace(/\u200B/g, ''))
  const re = new RegExp(IMAGE_IN_MARKDOWN_RE.source, 'g')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const src = parseImageSrcWithoutWidth(match[2] ?? '')
    if (!src.startsWith('attachment/')) continue
    const syncUri = resolveImageUri?.(src)
    if (!syncUri || !isDisplayableImageUri(syncUri)) {
      return true
    }
  }

  return false
}
