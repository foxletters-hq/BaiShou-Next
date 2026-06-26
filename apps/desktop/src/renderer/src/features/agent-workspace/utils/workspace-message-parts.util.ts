import type { AgentPart, FileChangePartData, MockToolInvocation, WorkspaceChangeEntry } from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export interface WorkspaceToolPartData {
  callId?: string
  name?: string
  arguments?: unknown
  result?: unknown
  status?: 'running' | 'completed' | 'failed' | string
  error?: string
}

export function isFileChangeData(data: unknown): data is FileChangePartData {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  return typeof record.path === 'string' && typeof record.kind === 'string'
}

export function formatWorkspaceToolDisplayName(name: string): string {
  return name.replace(/^mcp__[^_]+__/, '').replace(/_/g, ' ')
}

export function extractToolInvocations(parts: AgentPart[] | undefined): MockToolInvocation[] {
  if (!parts?.length) return []
  const invocations: MockToolInvocation[] = []
  for (const part of parts) {
    if (part.type !== 'tool') continue
    const data = (part.data ?? {}) as WorkspaceToolPartData
    const toolName = data.name?.trim()
    if (!toolName) continue
    const failed = data.status === 'failed'
    invocations.push({
      toolCallId: data.callId ?? part.id,
      toolName,
      state: failed ? 'call' : 'result',
      args: data.arguments ?? {},
      result: data.result ?? data.error ?? (failed ? 'Tool execution failed' : undefined)
    })
  }
  return invocations
}

export function collectWorkspaceFileChanges(messages: WorkspaceChatMessage[]): WorkspaceChangeEntry[] {
  const changes: WorkspaceChangeEntry[] = []
  for (const msg of messages) {
    for (const part of msg.parts ?? []) {
      if (part.type === 'file_change' && isFileChangeData(part.data)) {
        const status = (part.data as FileChangePartData & { status?: string }).status
        if (status === 'failed') continue
        changes.push({
          id: `${msg.id}:${part.data.path}`,
          path: part.data.path,
          kind: part.data.kind,
          additions: part.data.additions,
          deletions: part.data.deletions,
          data: part.data
        })
      }
    }
  }
  return changes
}

export function isFileChangePartFailed(data: FileChangePartData & { status?: string }): boolean {
  return data.status === 'failed'
}
