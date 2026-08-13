import type {
  AgentPart,
  FileChangePartData,
  MockToolInvocation,
  WorkspaceChangeEntry
} from '@baishou/shared'
import { normalizePartData, sortAgentMessageParts } from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export interface WorkspaceToolPartData {
  callId?: string
  name?: string
  arguments?: unknown
  result?: unknown
  status?: 'running' | 'completed' | 'failed' | string
  error?: string
  seq?: number
}

export type WorkspaceAssistantTimelineItem =
  | { kind: 'reasoning'; key: string; text: string }
  | { kind: 'text'; key: string; text: string }
  | { kind: 'tool'; key: string; invocation: MockToolInvocation }
  | { kind: 'file_change'; key: string; data: FileChangePartData }

/** 按落库 seq（优先）/ 扁平类型兜底 / createdAt 排序，保证时间线顺序 */
export function sortWorkspaceMessageParts(parts: AgentPart[] | undefined): AgentPart[] {
  return sortAgentMessageParts(parts)
}

/**
 * 将助手消息 parts 展开为线性时间线。
 */
export function buildWorkspaceAssistantTimeline(
  parts: AgentPart[] | undefined
): WorkspaceAssistantTimelineItem[] {
  const ordered = sortWorkspaceMessageParts(parts)
  const items: WorkspaceAssistantTimelineItem[] = []
  for (const part of ordered) {
    if (part.type === 'text') {
      const data = normalizePartData(part.data) as {
        text?: string
        displayText?: string
        isReasoning?: boolean
      }
      const text = String(
        (typeof data.displayText === 'string' && data.displayText.trim()
          ? data.displayText
          : null) ??
          data.text ??
          ''
      )
      if (!text.trim()) continue
      items.push({
        kind: data.isReasoning ? 'reasoning' : 'text',
        key: part.id,
        text
      })
      continue
    }
    if (part.type === 'tool') {
      const data = normalizePartData(part.data) as WorkspaceToolPartData
      const toolName =
        typeof data.name === 'string'
          ? data.name.trim()
          : typeof (data as { toolName?: string }).toolName === 'string'
            ? String((data as { toolName?: string }).toolName).trim()
            : ''
      if (!toolName || toolName === 'emoji_send') continue
      const failed = data.status === 'failed'
      items.push({
        kind: 'tool',
        key: part.id,
        invocation: {
          toolCallId: data.callId ?? part.id,
          toolName,
          state: failed ? 'call' : 'result',
          args: (data.arguments as Record<string, unknown>) ?? {},
          result: data.result ?? data.error ?? (failed ? 'Tool execution failed' : undefined)
        }
      })
      continue
    }
    if (part.type === 'file_change' && isFileChangeData(part.data)) {
      items.push({
        kind: 'file_change',
        key: part.id,
        data: part.data as FileChangePartData
      })
    }
  }
  return items
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
  return buildWorkspaceAssistantTimeline(parts)
    .filter(
      (item): item is Extract<WorkspaceAssistantTimelineItem, { kind: 'tool' }> =>
        item.kind === 'tool'
    )
    .map((item) => item.invocation)
}

export function collectWorkspaceFileChanges(
  messages: WorkspaceChatMessage[]
): WorkspaceChangeEntry[] {
  const changes: WorkspaceChangeEntry[] = []
  for (const msg of messages) {
    for (const part of sortWorkspaceMessageParts(msg.parts)) {
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
