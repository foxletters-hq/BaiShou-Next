import type { AgentWorkspaceEntry } from '@baishou/shared'

export function normalizeWorkspaceFolderKey(folderRoot: string): string {
  return folderRoot.replace(/\\/g, '/').toLowerCase()
}

export function folderDisplayName(folderRoot: string): string {
  return folderRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? folderRoot
}

function pickPreferredWorkspaceEntry(
  left: AgentWorkspaceEntry,
  right: AgentWorkspaceEntry
): AgentWorkspaceEntry {
  if (left.avatarPath && !right.avatarPath) return left
  if (right.avatarPath && !left.avatarPath) return right
  const leftPinned = Boolean(left.pinnedAt)
  const rightPinned = Boolean(right.pinnedAt)
  if (leftPinned !== rightPinned) return leftPinned ? left : right
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt.localeCompare(right.updatedAt) >= 0 ? left : right
  }
  return left.createdAt.localeCompare(right.createdAt) <= 0 ? left : right
}

/** Merge duplicate registry rows that point at the same folder path. */
export function dedupeAgentWorkspacesByFolder(
  workspaces: AgentWorkspaceEntry[]
): AgentWorkspaceEntry[] {
  const map = new Map<string, AgentWorkspaceEntry>()
  for (const entry of workspaces) {
    const key = normalizeWorkspaceFolderKey(entry.folderRoot)
    const existing = map.get(key)
    map.set(key, existing ? pickPreferredWorkspaceEntry(existing, entry) : entry)
  }
  return [...map.values()]
}

export function reconcileRegistryFromSessionBindings(
  workspaces: AgentWorkspaceEntry[],
  bindings: Array<{ folderRoot: string; folderDisplayName?: string }>,
  createId: () => string,
  nowIso: string,
  /** 用户主动移除过的目录，不再由会话绑定自动恢复 */
  excludedFolderKeys: ReadonlySet<string> = new Set()
): AgentWorkspaceEntry[] {
  const merged = dedupeAgentWorkspacesByFolder(workspaces)
  const map = new Map(merged.map((entry) => [normalizeWorkspaceFolderKey(entry.folderRoot), entry]))

  for (const binding of bindings) {
    const key = normalizeWorkspaceFolderKey(binding.folderRoot)
    if (map.has(key) || excludedFolderKeys.has(key)) continue
    const entry: AgentWorkspaceEntry = {
      id: createId(),
      folderRoot: binding.folderRoot,
      displayName: binding.folderDisplayName || folderDisplayName(binding.folderRoot),
      avatarPath: null,
      createdAt: nowIso,
      updatedAt: nowIso
    }
    map.set(key, entry)
  }

  return [...map.values()].sort((a, b) => {
    const aPinned = Boolean(a.pinnedAt)
    const bPinned = Boolean(b.pinnedAt)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if (aPinned && bPinned) {
      return Date.parse(b.pinnedAt ?? '') - Date.parse(a.pinnedAt ?? '')
    }
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export function resolveValidLastActiveWorkspaceId(
  lastActiveWorkspaceId: string | undefined,
  workspaces: AgentWorkspaceEntry[]
): string | undefined {
  if (!lastActiveWorkspaceId) return undefined
  return workspaces.some((entry) => entry.id === lastActiveWorkspaceId)
    ? lastActiveWorkspaceId
    : undefined
}
