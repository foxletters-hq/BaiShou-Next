import {
  listAgentGateFileChangePreviews,
  type AgentGateFileChangePreview,
  type AgentGateRequest,
  type WorkspaceChangeEntry
} from '@baishou/shared'

function pathKey(path: string): string {
  return path.replace(/\\/g, '/')
}

export function workspaceChangesFromGateRequest(
  request: AgentGateRequest | null | undefined
): WorkspaceChangeEntry[] {
  if (!request) return []
  return listAgentGateFileChangePreviews(request).map((preview) => ({
    id: `gate:${request.id}:${pathKey(preview.path)}`,
    path: preview.path,
    kind: preview.kind,
    additions: preview.additions,
    deletions: preview.deletions,
    data: {
      path: preview.path,
      kind: preview.kind,
      additions: preview.additions,
      deletions: preview.deletions,
      diff: preview.diff,
      previousPath: preview.previousPath
    }
  }))
}

export function workspaceChangeFromGatePreview(
  request: AgentGateRequest | null | undefined,
  preview: Pick<AgentGateFileChangePreview, 'path'>
): WorkspaceChangeEntry | undefined {
  const key = pathKey(preview.path)
  return workspaceChangesFromGateRequest(request).find((item) => pathKey(item.path) === key)
}

export function mergeWorkspaceChangeEntries(
  primary: WorkspaceChangeEntry[],
  extra: WorkspaceChangeEntry[]
): WorkspaceChangeEntry[] {
  const byPath = new Map<string, WorkspaceChangeEntry>()
  for (const entry of primary) {
    byPath.set(pathKey(entry.path), entry)
  }
  for (const entry of extra) {
    const key = pathKey(entry.path)
    const existing = byPath.get(key)
    if (!existing || (!existing.data.diff?.trim() && entry.data.diff?.trim())) {
      byPath.set(key, entry)
      continue
    }
    if (entry.data.diff?.trim()) {
      byPath.set(key, {
        ...existing,
        kind: entry.kind,
        additions: entry.additions,
        deletions: entry.deletions,
        data: { ...existing.data, ...entry.data }
      })
    }
  }
  return [...byPath.values()]
}
