import type { AgentWorkspaceEntry } from '@baishou/shared'

export function getWorkspaceInitialLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = [...trimmed][0]
  return first ?? '?'
}

const AVATAR_TONES = ['cyan', 'blue', 'green', 'orange', 'pink', 'purple', 'red', 'gray'] as const

export type WorkspaceAvatarTone = (typeof AVATAR_TONES)[number]

/** 按目录/名称哈希出稳定头像色，避免列表全是同色块 */
export function getWorkspaceAvatarTone(seed: string): WorkspaceAvatarTone {
  const text = seed.trim() || '?'
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'gray'
}

export function resolveWorkspaceAvatarSrc(avatarPath?: string | null): string | undefined {
  if (!avatarPath?.trim()) return undefined
  const trimmed = avatarPath.trim()
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('local://')
  ) {
    return trimmed
  }
  return `file://${trimmed.replace(/\\/g, '/')}`
}

export function workspaceEntryMatchesFolder(
  entry: AgentWorkspaceEntry,
  folderRoot: string | null | undefined
): boolean {
  if (!folderRoot) return false
  return (
    entry.folderRoot.replace(/\\/g, '/').toLowerCase() ===
    folderRoot.replace(/\\/g, '/').toLowerCase()
  )
}

export function isWorkspacePinned(entry: AgentWorkspaceEntry): boolean {
  return Boolean(entry.pinnedAt)
}

export type CompactRelativeTimeTranslate = (
  key: string,
  fallback: string,
  options?: { count: number }
) => string

export interface FormatCompactRelativeTimeOptions {
  t: CompactRelativeTimeTranslate
  nowMs?: number
  locale?: string
}

/** 会话行短相对时间：单位随当前语言切换，避免中英混用 */
export function formatCompactRelativeTime(
  updatedAt: string,
  options: FormatCompactRelativeTimeOptions
): string {
  const { t, nowMs = Date.now(), locale } = options
  const ts = Date.parse(updatedAt)
  if (Number.isNaN(ts)) return ''
  const diffMs = nowMs - ts
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t('common.compact_just_now', '刚刚')
  if (mins < 60) return t('common.compact_minutes', '{{count}}分钟', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('common.compact_hours', '{{count}}小时', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('common.compact_days', '{{count}}天', { count: days })
  const date = new Date(ts)
  const now = new Date(nowMs)
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(locale, { month: 'numeric', day: 'numeric' })
  }
  return date.toLocaleDateString(locale)
}

/** 置顶项目在前，其次最近活跃，再按 updatedAt。 */
export function sortAgentWorkspaces(
  list: AgentWorkspaceEntry[],
  lastActiveId?: string | null
): AgentWorkspaceEntry[] {
  return [...list].sort((a, b) => {
    const aPinned = isWorkspacePinned(a)
    const bPinned = isWorkspacePinned(b)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if (aPinned && bPinned) {
      return Date.parse(b.pinnedAt ?? '') - Date.parse(a.pinnedAt ?? '')
    }
    if (lastActiveId) {
      if (a.id === lastActiveId) return -1
      if (b.id === lastActiveId) return 1
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
}
