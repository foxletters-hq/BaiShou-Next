import { stripDedicatedTagLinesFromContent } from './diary-content-tags.util'

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
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?mark>/gi, '')
    .replace(/\u200B/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 日记卡片 Markdown 预览：保留语法，剥离独立标签行并清理 FTS 高亮标签与零宽字符 */
export function normalizeDiaryPreviewMarkdown(text: string | null | undefined): string {
  if (!text) return ''
  return stripPreviewNoise(stripDedicatedTagLinesFromContent(text))
}

/** 日记列表/搜索纯文本预览：去掉 Markdown、FTS 高亮标签与零宽字符，保留换行 */
export function formatDiaryPreviewText(text: string | null | undefined): string {
  if (!text) return ''
  return stripPreviewNoise(text)
    .replace(/<\/?[^>]+>/g, '')
    .replace(/^#{1,6}\s*/gm, '')
}

/**
 * 日记卡片 Markdown 预览：保留粗体等行内语法，但去掉 ATX 标题标记。
 * 搜索分片常以 ###### 开头；标题换行后 Markdown 会把后续正文误解析为同级标题样式。
 */
export function prepareDiaryCardPreviewMarkdown(text: string | null | undefined): string {
  const normalized = normalizeDiaryPreviewMarkdown(text)
  if (!normalized) return ''
  return normalized.replace(/^#{1,6}\s+/gm, '')
}
