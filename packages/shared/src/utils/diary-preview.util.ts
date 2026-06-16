/** 语义搜索命中分片：去掉嵌入时写入的标签/日期前缀 */
export function formatSemanticChunkSnippet(text: string | null | undefined): string {
  if (!text) return ''
  const stripped = text
    .replace(/^\[标签:[^\]]*\]\s*/, '')
    .replace(/^\[\d{4}-\d{2}-\d{2} 日记:\]\s*\n?/, '')
  return formatDiaryPreviewText(stripped)
}

/** 日记列表/搜索预览：去掉 Markdown、FTS 高亮标签与零宽字符，保留换行 */
export function formatDiaryPreviewText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?mark>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\u200B/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
