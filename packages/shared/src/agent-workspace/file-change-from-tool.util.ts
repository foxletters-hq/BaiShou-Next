import type { FileChangeKind, FileChangePartData } from './file-change.types'

export type FileMutateInvocationLike = {
  toolCallId?: string
  toolName?: string
  name?: string
  args?: unknown
}

const FILE_MUTATE_TOOLS = new Set([
  'workspace_write',
  'workspace_patch',
  'workspace_delete',
  'workspace_rename'
])

const MCP_TOOL_PREFIX = /^mcp__[^_]+__/

export function stripWorkspaceToolPrefix(name: string): string {
  return name.replace(MCP_TOOL_PREFIX, '')
}

export function isWorkspaceFileMutateTool(name: string | undefined): boolean {
  if (!name) return false
  return FILE_MUTATE_TOOLS.has(stripWorkspaceToolPrefix(name.trim()))
}

function readArgsRecord(args: unknown): Record<string, unknown> | null {
  if (args == null) return null
  if (typeof args === 'string') {
    const trimmed = args.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>
  }
  return null
}

function readArgString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function countLines(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

function additionDiff(content: string): string | undefined {
  if (!content) return undefined
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `+${line}`)
    .join('\n')
}

function replacementDiff(before: string, after: string): string | undefined {
  if (!before && !after) return undefined
  const removed = before
    ? before
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => `-${line}`)
        .join('\n')
    : ''
  const added = after
    ? after
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => `+${line}`)
        .join('\n')
    : ''
  return [removed, added].filter(Boolean).join('\n')
}

function toolNameOf(invocation: FileMutateInvocationLike): string {
  const raw = invocation.toolName || invocation.name || ''
  return stripWorkspaceToolPrefix(String(raw).trim())
}

/** 还没有 file_change part 时，用写入/修补参数拼一份可展开的 diff */
export function fileChangeFromMutateInvocation(
  invocation: FileMutateInvocationLike
): FileChangePartData | null {
  const args = readArgsRecord(invocation.args)
  if (!args) return null
  const toolName = toolNameOf(invocation)
  if (!FILE_MUTATE_TOOLS.has(toolName)) return null

  const path = readArgString(args.path) ?? readArgString(args.filePath) ?? readArgString(args.file)
  const toolCallId =
    typeof invocation.toolCallId === 'string' && invocation.toolCallId.trim()
      ? invocation.toolCallId
      : undefined

  if (toolName === 'workspace_rename') {
    const from = readArgString(args.from) ?? readArgString(args.path) ?? readArgString(args.oldPath)
    const to = readArgString(args.to) ?? readArgString(args.newPath) ?? readArgString(args.target)
    if (!from && !to) return null
    return {
      path: to ?? from ?? '',
      kind: 'rename',
      previousPath: from,
      additions: 0,
      deletions: 0,
      toolCallId
    }
  }

  if (toolName === 'workspace_delete') {
    if (!path) return null
    return {
      path,
      kind: 'delete',
      additions: 0,
      deletions: 0,
      toolCallId
    }
  }

  if (toolName === 'workspace_patch') {
    if (!path) return null
    const before = readArgString(args.old_text) ?? readArgString(args.oldText) ?? ''
    const after = readArgString(args.new_text) ?? readArgString(args.newText) ?? ''
    return {
      path,
      kind: 'modify',
      additions: countLines(after),
      deletions: countLines(before),
      preview: after.slice(0, 400) || before.slice(0, 400) || undefined,
      diff: replacementDiff(before, after),
      toolCallId
    }
  }

  if (!path) return null
  const content = typeof args.content === 'string' ? args.content : ''
  const kind: FileChangeKind = 'create'
  return {
    path,
    kind,
    additions: countLines(content),
    deletions: 0,
    preview: content.slice(0, 400) || undefined,
    diff: additionDiff(content),
    toolCallId
  }
}
