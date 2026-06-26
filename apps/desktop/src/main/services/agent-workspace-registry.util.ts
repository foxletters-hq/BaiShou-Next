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
  nowIso: string
): AgentWorkspaceEntry[] {
  const merged = dedupeAgentWorkspacesByFolder(workspaces)
  const map = new Map(merged.map((entry) => [normalizeWorkspaceFolderKey(entry.folderRoot), entry]))

  for (const binding of bindings) {
    const key = normalizeWorkspaceFolderKey(binding.folderRoot)
    if (map.has(key)) continue
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

  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
