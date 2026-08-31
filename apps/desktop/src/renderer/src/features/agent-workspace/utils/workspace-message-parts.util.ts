import type {
  AgentPart,
  AgentStreamTimelineItem,
  FileChangePartData,
  MockToolInvocation,
  WorkspaceChangeEntry
} from '@baishou/shared'
import {
  fileChangeFromMutateInvocation,
  isWorkspaceFileMutateTool,
  normalizePartData,
  sortAgentMessageParts
} from '@baishou/shared'
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

export type WorkspaceAssistantTimelineGroup =
  | Extract<WorkspaceAssistantTimelineItem, { kind: 'reasoning' | 'text' }>
  | {
      kind: 'tools'
      key: string
      invocations: MockToolInvocation[]
    }
  | {
      kind: 'file_ops'
      key: string
      invocations: MockToolInvocation[]
      items: Array<{ key: string; data: FileChangePartData }>
    }
  | { kind: 'file_change_failed'; key: string; data: FileChangePartData }

/** 相邻只读工具收成一组；写入类工具与成功文件变更收成一组，避免每条都占一行 */
export function groupWorkspaceAssistantTimeline(
  items: WorkspaceAssistantTimelineItem[]
): WorkspaceAssistantTimelineGroup[] {
  const groups: WorkspaceAssistantTimelineGroup[] = []
  let pendingFiles: Array<{ key: string; data: FileChangePartData }> = []
  let pendingMutateTools: Array<{ key: string; invocation: MockToolInvocation }> = []
  let pendingTools: Array<{ key: string; invocation: MockToolInvocation }> = []

  const flushFilesAndMutations = () => {
    if (pendingMutateTools.length === 0 && pendingFiles.length === 0) return
    groups.push({
      kind: 'file_ops',
      key: `files:${pendingMutateTools[0]?.key ?? pendingFiles[0]!.key}`,
      invocations: pendingMutateTools.map((entry) => entry.invocation),
      items: pendingFiles
    })
    pendingMutateTools = []
    pendingFiles = []
  }

  const flushTools = () => {
    if (pendingTools.length === 0) return
    groups.push({
      kind: 'tools',
      key: `tools:${pendingTools[0]!.key}`,
      invocations: pendingTools.map((entry) => entry.invocation)
    })
    pendingTools = []
  }

  for (const item of items) {
    if (item.kind === 'tool' && isWorkspaceFileMutateTool(item.invocation.toolName)) {
      flushTools()
      pendingMutateTools.push({ key: item.key, invocation: item.invocation })
      continue
    }
    if (item.kind === 'tool') {
      flushFilesAndMutations()
      pendingTools.push({ key: item.key, invocation: item.invocation })
      continue
    }
    if (item.kind === 'file_change') {
      flushTools()
      if (isFileChangePartFailed(item.data)) {
        flushFilesAndMutations()
        groups.push({ kind: 'file_change_failed', key: item.key, data: item.data })
        continue
      }
      pendingFiles.push({ key: item.key, data: item.data })
      continue
    }
    flushFilesAndMutations()
    flushTools()
    groups.push(item)
  }
  flushFilesAndMutations()
  flushTools()
  return groups
}

export type WorkspaceStreamTimelineGroup =
  | Extract<AgentStreamTimelineItem, { kind: 'reasoning' | 'text' }>
  | {
      kind: 'tools'
      items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>
    }
  | {
      kind: 'file_ops'
      items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>
    }

/** 流式时间线：只读工具一组，写入类工具另收成文件变更组 */
export function groupStreamTimelineItems(
  items: AgentStreamTimelineItem[]
): WorkspaceStreamTimelineGroup[] {
  const groups: WorkspaceStreamTimelineGroup[] = []
  for (const item of items) {
    if (item.kind !== 'tool') {
      groups.push(item)
      continue
    }
    const kind = isWorkspaceFileMutateTool(item.name) ? 'file_ops' : 'tools'
    const last = groups[groups.length - 1]
    if (last?.kind === kind) {
      last.items.push(item)
    } else {
      groups.push({ kind, items: [item] })
    }
  }
  return groups
}

function pathsEqual(left: string, right: string): boolean {
  return left.replace(/\\/g, '/') === right.replace(/\\/g, '/')
}

/** 把写入工具与 file_change 合成一份列表：优先真实 diff，缺省再用工具参数 */
export function buildFileOpEntries(
  messageId: string,
  invocations: MockToolInvocation[],
  changes: FileChangePartData[]
): WorkspaceChangeEntry[] {
  const remaining = [...changes]
  const entries: WorkspaceChangeEntry[] = []
  const used = new Set<FileChangePartData>()

  const takeMatch = (invocation: MockToolInvocation): FileChangePartData | undefined => {
    const callId = invocation.toolCallId
    if (callId) {
      const byId = remaining.find((item) => item.toolCallId === callId)
      if (byId) return byId
    }
    const synthetic = fileChangeFromMutateInvocation(invocation)
    if (!synthetic?.path) return undefined
    return remaining.find((item) => pathsEqual(item.path, synthetic.path))
  }

  for (const invocation of invocations) {
    const matched = takeMatch(invocation)
    if (matched) {
      used.add(matched)
      entries.push(toWorkspaceChangeEntry(messageId, matched))
      continue
    }
    const synthetic = fileChangeFromMutateInvocation(invocation)
    if (synthetic) {
      entries.push(toWorkspaceChangeEntry(messageId, synthetic))
    }
  }

  for (const data of remaining) {
    if (used.has(data)) continue
    entries.push(toWorkspaceChangeEntry(messageId, data))
  }

  const byPath = new Map<string, WorkspaceChangeEntry>()
  for (const entry of entries) {
    const key = entry.path.replace(/\\/g, '/')
    const existing = byPath.get(key)
    if (!existing) {
      byPath.set(key, entry)
      continue
    }
    const existingHasDiff = Boolean(existing.data.diff?.trim())
    const nextHasDiff = Boolean(entry.data.diff?.trim())
    if (!existingHasDiff && nextHasDiff) byPath.set(key, entry)
  }
  return [...byPath.values()]
}

export function toWorkspaceChangeEntry(
  messageId: string,
  data: FileChangePartData
): WorkspaceChangeEntry {
  return {
    id: `${messageId}:${data.path}`,
    path: data.path,
    kind: data.kind,
    additions: data.additions,
    deletions: data.deletions,
    data
  }
}

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
