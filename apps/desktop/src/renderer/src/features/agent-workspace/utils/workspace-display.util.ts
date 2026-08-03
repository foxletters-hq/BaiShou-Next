import type { AgentWorkspaceEntry } from '@baishou/shared'

export function getWorkspaceInitialLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = [...trimmed][0]
  return first ?? '?'
}

const AVATAR_TONES = [
  'cyan',
  'blue',
  'green',
  'orange',
  'pink',
  'purple',
  'red',
  'gray'
] as const

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
