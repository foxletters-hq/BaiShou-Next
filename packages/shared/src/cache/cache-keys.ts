/** 应用层命名缓存空间 — 规则表与 Registry 共用 */
export type CacheKey =
  | 'summary.dashboard'
  | 'summary.gallery'
  | 'diary.list'
  | 'avatar.user'
  | 'avatar.assistant'
  | 'attachment.thumb'
  | 'attachment.preview'
  | 'chat.attachment'
  | 'mcp.toolContext'
  | 'tts.synthesis'

export const ALL_CACHE_KEYS: readonly CacheKey[] = [
  'summary.dashboard',
  'summary.gallery',
  'diary.list',
  'avatar.user',
  'avatar.assistant',
  'attachment.thumb',
  'attachment.preview',
  'chat.attachment',
  'mcp.toolContext',
  'tts.synthesis'
] as const
