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

export function commonPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i += 1
  return i
}

/** RN 与 WebView 内容差异是否像切换日记等外部替换，而非用户正在输入 */
export function looksLikeExternalContentReplace(prev: string, next: string): boolean {
  if (prev === next) return false
  if (prev.length === 0 || next.length === 0) return true
  const prefix = commonPrefixLength(prev, next)
  const threshold = Math.min(32, Math.floor(Math.min(prev.length, next.length) * 0.5))
  return prefix < threshold
}
