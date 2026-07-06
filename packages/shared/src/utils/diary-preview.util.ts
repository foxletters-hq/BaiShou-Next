import { isDiaryTimestampLine, stripDedicatedTagLinesFromContent } from './diary-content-tags.util'

export type DiaryCardPreviewBlock =
  | { kind: 'markdown'; text: string }
  | { kind: 'quote'; text: string }

const BLOCKQUOTE_LINE_RE = /^\s*>\s?(.*)$/

/** 将卡片预览拆成普通 Markdown 块与逐行引用块，避免 CommonMark 懒续行扩大引用范围 */
export function buildDiaryCardPreviewBlocks(text: string | null | undefined): DiaryCardPreviewBlock[] {
  const prepared = prepareDiaryCardPreviewMarkdown(text)
  if (!prepared) return []

  const blocks: DiaryCardPreviewBlock[] = []
  let markdownBuffer: string[] = []

  const flushMarkdown = () => {
    const joined = markdownBuffer.join('\n').trimEnd()
    if (joined) blocks.push({ kind: 'markdown', text: joined })
    markdownBuffer = []
  }

  for (const line of prepared.split('\n')) {
    const quoteMatch = line.match(BLOCKQUOTE_LINE_RE)
    if (quoteMatch) {
      flushMarkdown()
      blocks.push({ kind: 'quote', text: quoteMatch[1] ?? '' })
      continue
    }
    markdownBuffer.push(line)
  }

  flushMarkdown()
  return blocks
}

/** 语义搜索命中分片：去掉嵌入时写入的标签/日期前缀 */
export function formatSemanticChunkSnippet(text: string | null | undefined): string {
  if (!text) return ''
  const stripped = text
    .replace(/^\[标签:[^\]]*\]\s*/, '')
    .replace(/^\[\d{4}-\d{2}-\d{2} 日记:\]\s*\n?/, '')
  return formatDiaryPreviewText(stripped)
}

function stripPreviewNoise(text: string): string {
  return text
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\u200B/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** FTS / LIKE 搜索片段中的 <b>、<mark> 高亮标记 → Markdown 粗体，便于卡片与正文统一走 Markdown 渲染 */
export function convertFtsHighlightTagsToMarkdownBold(text: string): string {
  return text.replace(/<\/?(b|mark)>/gi, '**')
}

function normalizePreviewMarkdownNoise(text: string): string {
  return text
    .replace(/\u200B/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 日记卡片 Markdown 预览：保留语法，剥离独立标签行；搜索高亮转为 **粗体** */
export function normalizeDiaryPreviewMarkdown(text: string | null | undefined): string {
  if (!text) return ''
  const body = stripDedicatedTagLinesFromContent(text)
  return normalizePreviewMarkdownNoise(convertFtsHighlightTagsToMarkdownBold(body))
}

/** 日记列表/搜索纯文本预览：去掉 Markdown、FTS 高亮标签与零宽字符，保留换行 */
export function formatDiaryPreviewText(text: string | null | undefined): string {
  if (!text) return ''
  return stripPreviewNoise(text)
    .replace(/<\/?[^>]+>/g, '')
    .replace(/^#{1,6}\s*/gm, '')
}

/**
 * 日记卡片 Markdown 预览：保留粗体等行内语法；时间戳行保留为标题级样式；
 * 其余 ATX 标题去掉 `#`，避免搜索分片误把正文解析成标题。
 */
export function prepareDiaryCardPreviewMarkdown(text: string | null | undefined): string {
  const normalized = normalizeDiaryPreviewMarkdown(text)
  if (!normalized) return ''
  return normalized
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (isDiaryTimestampLine(trimmed)) {
        const level = trimmed.match(/^(#{1,6})/)?.[1]?.length ?? 6
        const time = trimmed.replace(/^#{1,6}\s*/, '')
        return `${'#'.repeat(Math.min(level, 6))} ${time}`
      }
      return line.replace(/^#{1,6}\s+/, '')
    })
    .join('\n')
}
