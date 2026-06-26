import type { AgentWorkspaceEntry } from '@baishou/shared'

export function getWorkspaceInitialLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = [...trimmed][0]
  return first ?? '?'
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
