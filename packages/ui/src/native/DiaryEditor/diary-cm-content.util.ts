/** WebView bundle 泄漏进日记正文时的特征（用于拦截误保存） */
export function isLikelyEditorBundleLeak(content: string): boolean {
  if (!content || content.length < 80) return false
  const markers = [
    'DiaryEditorBundle',
    'createDiaryCodeMirror',
    'ReactNativeWebView',
    'matchBefore',
    'Object.defineProperty'
  ]
  let hits = 0
  for (const marker of markers) {
    if (content.includes(marker)) hits += 1
  }
  if (hits >= 3) return true
  return hits >= 2 && content.length >= 200
}

/** 从 Markdown 文档中删除指定区间（图片删除等场景） */
export function deleteMarkdownRange(content: string, from: number, to: number): string {
  const safeFrom = Math.max(0, Math.min(from, content.length))
  const safeTo = Math.max(safeFrom, Math.min(to, content.length))
  return content.slice(0, safeFrom) + content.slice(safeTo)
}
