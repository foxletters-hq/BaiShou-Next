export function segmentChinese(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/([\u4e00-\u9fa5])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanSegmentedSnippet(snippet: string | null | undefined): string {
  if (!snippet) return ''
  return snippet
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?mark>/gi, '')
    .replace(/([\u4e00-\u9fa5])\s+(?![a-zA-Z0-9])/g, '$1')
    .replace(/(?<![a-zA-Z0-9])\s+([\u4e00-\u9fa5])/g, '$1')
}

/** 数字/标点类查询不走中文分词，保留原样供 FTS 与 LIKE 回退 */
export function normalizeSearchQuery(query: string): string {
  return query.replace(/"/g, ' ').trim()
}

export function isNumericLikeQuery(query: string): boolean {
  return /[\d.:]/.test(query) || /^[\d\s.:+-]+$/.test(query)
}
