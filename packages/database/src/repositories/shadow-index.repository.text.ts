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
    .replace(/([\u4e00-\u9fa5])\s+(?![a-zA-Z0-9])/g, '$1')
    .replace(/(?<![a-zA-Z0-9])\s+([\u4e00-\u9fa5])/g, '$1')
}
