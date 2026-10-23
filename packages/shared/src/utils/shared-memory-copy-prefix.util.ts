/**
 * 共同回忆「复制前缀」兼容处理。
 *
 * 早期版本把示例话术直接写进了用户配置（Hi，这是我的回忆...）。
 * 这些值不是用户真实的自定义内容，读取时视为未设置，回落到当前语言的默认前缀。
 */
const LEGACY_SHARED_MEMORY_COPY_PREFIXES = new Set([
  'Hi, 这是我的回忆...',
  'Hi，这是我的回忆...',
  'Hi, these are my memories...',
  'Hi，these are my memories...',
  'こんにちは、これは私の思い出です...'
])

export function normalizeSharedMemoryCopyPrefix(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''
  return LEGACY_SHARED_MEMORY_COPY_PREFIXES.has(trimmed) ? '' : trimmed
}
