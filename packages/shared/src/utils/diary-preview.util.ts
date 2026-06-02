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
