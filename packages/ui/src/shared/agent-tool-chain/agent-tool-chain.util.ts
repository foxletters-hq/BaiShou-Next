import { getToolResultRawContent, type ToolInvocationLike } from '../tool-result.util'

export type AgentToolChainItemStatus = 'loading' | 'success' | 'error'

export interface AgentToolChainStreamingTool {
  name: string
  durationMs: number
  startTime?: number | string
  toolCallId?: string
  result?: unknown
  args?: unknown
  error?: string
}

export interface AgentToolChainItemModel {
  key: string
  toolName: string
  status: AgentToolChainItemStatus
  durationMs?: number
  invocation?: ToolInvocationLike
  hasContent: boolean
}

export function formatToolDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function hasInvocationContent(invocation?: ToolInvocationLike): boolean {
  if (!invocation || invocation.result === undefined || invocation.result === null) return false
  return Boolean(getToolResultRawContent(invocation).trim())
}

function buildStreamingInvocation(
  tool: AgentToolChainStreamingTool,
  index: number
): ToolInvocationLike | undefined {
  const result = tool.result ?? tool.error
  if (result === undefined || result === null) {
    if (tool.args === undefined) return undefined
    return {
      toolCallId: tool.toolCallId ?? `stream-${tool.name}-${index}`,
      toolName: tool.name,
      args: tool.args
    }
  }
  return {
    toolCallId: tool.toolCallId ?? `stream-${tool.name}-${index}`,
    toolName: tool.name,
    result,
    args: tool.args
  }
}

function streamingToolKey(tool: AgentToolChainStreamingTool, index: number): string {
  return tool.toolCallId ?? `stream-done-${tool.name}-${tool.startTime ?? index}`
}

function readInvocationToolName(inv: ToolInvocationLike, index: number): string {
  return inv.toolName || (inv as { name?: string }).name || inv.toolCallId || `inv-${index}`
}

function isUnansweredInvocation(inv: ToolInvocationLike): boolean {
  return inv.result === undefined || inv.result === null || inv.result === ''
}

export function buildAgentToolChainItems(options: {
  invocations?: ToolInvocationLike[]
  completedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
  activeToolArgs?: unknown
  isToolError?: (invocation: ToolInvocationLike) => boolean
}): AgentToolChainItemModel[] {
  const items: AgentToolChainItemModel[] = []
  const indexByKey = new Map<string, number>()
  const isToolError = options.isToolError ?? (() => false)
  const invocations = options.invocations ?? []
  const unansweredActive = options.activeToolName
    ? invocations.find((inv) => {
        const name = inv.toolName || (inv as { name?: string }).name
        return name === options.activeToolName && isUnansweredInvocation(inv)
      })
    : undefined

  const upsertItem = (item: AgentToolChainItemModel) => {
    const existingIdx = indexByKey.get(item.key)
    if (existingIdx != null) {
      const existing = items[existingIdx]!
      items[existingIdx] = {
        ...existing,
        ...item,
        invocation: item.invocation ?? existing.invocation,
        durationMs: item.durationMs ?? existing.durationMs,
        hasContent: item.hasContent || existing.hasContent
      }
      return
    }
    indexByKey.set(item.key, items.length)
    items.push(item)
  }

  for (const [index, tool] of (options.completedTools ?? []).entries()) {
    const invocation = buildStreamingInvocation(tool, index)
    upsertItem({
      key: streamingToolKey(tool, index),
      toolName: tool.name,
      status: tool.error ? 'error' : 'success',
      durationMs: tool.durationMs,
      invocation,
      hasContent: hasInvocationContent(invocation)
    })
  }

  if (options.activeToolName && !unansweredActive) {
    const invocation =
      options.activeToolArgs === undefined
        ? undefined
        : {
            toolCallId: `stream-active-${options.activeToolName}`,
            toolName: options.activeToolName,
            args: options.activeToolArgs
          }
    upsertItem({
      key: `stream-active-${options.activeToolName}`,
      toolName: options.activeToolName,
      status: 'loading',
      invocation,
      hasContent: false
    })
  }

  for (const [index, inv] of invocations.entries()) {
    const invToolName = readInvocationToolName(inv, index)
    const key = inv.toolCallId || invToolName || `inv-${index}`
    const isActiveUnanswered =
      !isToolError(inv) &&
      isUnansweredInvocation(inv) &&
      Boolean(options.activeToolName) &&
      invToolName === options.activeToolName
    const awaitingPersistedAsk =
      !isToolError(inv) &&
      invToolName === 'companion_ask' &&
      isUnansweredInvocation(inv) &&
      inv.state === 'partial-call'
    upsertItem({
      key,
      toolName: invToolName,
      status: isToolError(inv) ? 'error' : isActiveUnanswered || awaitingPersistedAsk ? 'loading' : 'success',
      invocation: inv,
      hasContent: hasInvocationContent(inv)
    })
  }

  return items
}
