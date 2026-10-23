import type { MarkdownStyle } from 'react-native-enriched-markdown'
import { markdownSpacingTokens, mobileTypography, sharedTokens } from '../../theme/tokens'
import {
  parseImageSrcWithoutWidth,
  stripImageWidthInMarkdown
} from '../DiaryEditor/diary-image-markdown.util'
import type { useNativeTheme } from '../theme'

export type StreamdownMarkdownVariant = 'default' | 'chat' | 'ancillary' | 'preview'

const MARKDOWN_HEADING_FONT_SIZES = [
  mobileTypography.title.fontSize,
  mobileTypography.title.fontSize,
  mobileTypography.primary.fontSize,
  mobileTypography.primary.fontSize,
  mobileTypography.body.fontSize,
  mobileTypography.body.fontSize
] as const

function resolveHeadingFontSize(level: 1 | 2 | 3 | 4 | 5 | 6): number {
  return MARKDOWN_HEADING_FONT_SIZES[level - 1]
}

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
  variant: StreamdownMarkdownVariant,
  contentFontScale = 1
): MarkdownStyle {
  const isPreview = variant === 'preview'
  const isAncillary = variant === 'ancillary'
  const isChat = variant === 'chat' || isAncillary
  const scale = Number.isFinite(contentFontScale) && contentFontScale > 0 ? contentFontScale : 1
  const bodyFontSize = Math.round(
    (isAncillary ? mobileTypography.secondary.fontSize : mobileTypography.body.fontSize) * scale
  )
  const bodyLineHeight = Math.round((isAncillary ? 20 : mobileTypography.body.lineHeight) * scale)
  const bodyColor = isAncillary ? colors.textSecondary : colors.textPrimary
  const paragraphMargin = isPreview
    ? markdownSpacingTokens.paragraphPreview
    : markdownSpacingTokens.paragraph
  const codeFontSize = Math.round(
    (isAncillary ? mobileTypography.caption.fontSize : mobileTypography.secondary.fontSize) * scale
  )
  const headingWeight = mobileTypography.title.fontWeight
  const h = markdownSpacingTokens.headings

  return {
    paragraph: {
      color: bodyColor,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight,
      marginBottom: paragraphMargin
    },
    h1: {
      color: colors.textPrimary,
      fontSize: Math.round(resolveHeadingFontSize(1) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h1.topCompact : h.h1.top,
      marginBottom: isPreview ? h.h1.bottomCompact : isChat ? h.h1.bottomCompact : h.h1.bottom
    },
    h2: {
      color: colors.textPrimary,
      fontSize: Math.round(resolveHeadingFontSize(2) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h2.topCompact : h.h2.top,
      marginBottom: isPreview ? h.h2.bottomCompact : isChat ? h.h2.bottomCompact : h.h2.bottom
    },
    h3: {
      color: colors.textPrimary,
      fontSize: Math.round(resolveHeadingFontSize(3) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h3.topCompact : h.h3.top,
      marginBottom: isPreview ? h.h3.bottom : h.h3.bottom
    },
    h4: {
      color: colors.textPrimary,
      fontSize: Math.round(resolveHeadingFontSize(4) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h4.topCompact : h.h4.top,
      marginBottom: isPreview ? h.h4.bottom : h.h4.bottom
    },
    h5: {
      color: colors.textPrimary,
      fontSize: Math.round(resolveHeadingFontSize(5) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h5.topCompact : h.h5.top,
      marginBottom: isPreview ? h.h5.bottom : h.h5.bottom
    },
    h6: {
      color: isPreview ? colors.primary : colors.textSecondary,
      fontSize: Math.round(resolveHeadingFontSize(6) * scale),
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h6.topCompact : h.h6.top,
      marginBottom: isPreview ? h.h6.bottomCompact : h.h6.bottom
    },
    blockquote: isPreview
      ? {
          color: colors.textSecondary,
          borderColor: colors.primary,
          backgroundColor: colors.bgSurface,
          marginBottom: paragraphMargin
        }
      : {
          color: colors.textSecondary,
          borderColor: colors.primary,
          backgroundColor: colors.bgSurfaceLow ?? colors.bgSurfaceNormal,
          marginBottom: paragraphMargin
        },
    list: {
      color: bodyColor,
      bulletColor: bodyColor,
      markerColor: bodyColor,
      marginBottom: isChat ? markdownSpacingTokens.listCompact : markdownSpacingTokens.list
    },
    code: {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurfaceNormal,
      borderColor: isPreview ? colors.bgSurfaceNormal : colors.borderSubtle,
      fontSize: isPreview ? bodyFontSize : codeFontSize
    },
    codeBlock: {
      color: colors.textPrimary,
      backgroundColor: colors.bgSurfaceNormal,
      borderColor: isPreview ? colors.bgSurfaceNormal : colors.borderSubtle,
      borderRadius: sharedTokens.radius.sm,
      padding: sharedTokens.spacing.smPlus,
      marginBottom: paragraphMargin,
      fontSize: isPreview ? bodyFontSize : codeFontSize,
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
      // 预览卡片里分割线要比编辑器更轻，避免抢正文
      color: isPreview ? colors.borderSubtle : colors.borderMuted,
      marginTop: isPreview
        ? markdownSpacingTokens.dividerPreview
        : isChat
          ? markdownSpacingTokens.dividerCompact
          : markdownSpacingTokens.divider,
      marginBottom: isPreview
        ? markdownSpacingTokens.dividerPreview
        : isChat
          ? markdownSpacingTokens.dividerCompact
          : markdownSpacingTokens.divider
    },
    table: {
      color: bodyColor,
      headerTextColor: colors.textPrimary,
      headerBackgroundColor: colors.bgSurfaceNormal,
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
      backgroundColor: colors.bgSurfaceNormal
    },
    inlineMath: { color: colors.textPrimary }
  }
}

/**
 * CommonMark 会吞掉段落内单换行，但 TextInput 编辑态仍保留。
 * 将段落内单换行与尾部换行转为硬换行（行末两空格），使展示与编辑一致。
 */
export function preserveChatDisplayNewlines(content: string): string {
  const trailing = content.match(/\n+$/)
  const trailingNewlineCount = trailing ? trailing[0].length : 0
  const base = trailingNewlineCount > 0 ? content.slice(0, -trailingNewlineCount) : content

  const normalized = base
    .split(/\n\n/)
    .map((paragraph) => paragraph.replace(/\n/g, '  \n'))
    .join('\n\n')

  if (trailingNewlineCount === 0) return normalized
  return normalized + '  \n'.repeat(trailingNewlineCount)
}

/** @deprecated 使用 preserveChatDisplayNewlines */
export function preserveChatTrailingNewlines(content: string): string {
  return preserveChatDisplayNewlines(content)
}

/** 估算聊天气泡 Markdown 最小高度，避免 EnrichedMarkdownText 少报高度被父级裁剪 */
export function estimateChatMarkdownMinHeight(
  content: string,
  lineHeight = mobileTypography.body.lineHeight
): number {
  if (!content.trim()) return 0
  const charsPerLine = 26
  const lines = content.split('\n').reduce((total, line) => {
    const trimmed = line.trim()
    if (!trimmed) return total + 1
    return total + Math.max(1, Math.ceil(trimmed.length / charsPerLine))
  }, 0)
  return Math.max(lineHeight * 2, lines * lineHeight + lineHeight)
}

/** 聊天正文里的装饰性反引号（如颜文字）会破坏 md4c 行内代码解析 */
export function softenDecorativeBackticksForChat(content: string): string {
  return content
    .replace(/\(´・ω・`\)/g, "(´・ω・')")
    .replace(/(\([^\n)]*?)`([^\n)]*?\))/g, (_match, before, after) => `${before}'${after}`)
}

/** 剥离零宽字符与日记宽度语法，并将可同步解析的 attachment 图片写回可加载 URI */
export function prepareNativeStreamdownMarkdown(
  content: string,
  resolveImageUri?: (src: string) => string | null | undefined,
  options?: { chat?: boolean }
): string {
  let text = stripImageWidthInMarkdown(content.replace(/\u200B/g, ''))
  if (options?.chat) {
    text = softenDecorativeBackticksForChat(text)
  }
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
