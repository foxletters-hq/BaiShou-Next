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

/**
 * RN 受控 content 落后于 WebView 时的回声。
 * 长按删除时 WebView 已更短，RN 若把更长旧正文 setContent 回去，光标会停在已删位置、文字却重现。
 */
export function isStaleControlledContentEcho(webViewContent: string, rnContent: string): boolean {
  if (webViewContent === rnContent) return true
  // WebView 已删空，RN 仍持有旧正文
  if (webViewContent.length === 0 && rnContent.length > 0) return true
  // 删除超前：RN 更长且以 WebView 正文为前缀（准备把已删后缀塞回）
  if (webViewContent.length < rnContent.length && rnContent.startsWith(webViewContent)) {
    return true
  }
  // 输入超前：WebView 更长且以 RN 为前缀
  if (rnContent.length < webViewContent.length && webViewContent.startsWith(rnContent)) {
    return true
  }
  return false
}

/** RN 与 WebView 内容差异是否像切换日记等外部替换，而非用户正在输入 */
export function looksLikeExternalContentReplace(prev: string, next: string): boolean {
  if (prev === next) return false
  if (prev.length === 0 || next.length === 0) return true
  const prefix = commonPrefixLength(prev, next)
  const threshold = Math.min(32, Math.floor(Math.min(prev.length, next.length) * 0.5))
  return prefix < threshold
}
