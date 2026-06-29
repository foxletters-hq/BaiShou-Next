import { getToolResultRawContent, type ToolInvocationLike } from '../tool-result.util'

export type AgentToolChainItemStatus = 'loading' | 'success' | 'error'

export interface AgentToolChainStreamingTool {
  name: string
  durationMs: number
  startTime?: number | string
  toolCallId?: string
  result?: unknown
  args?: unknown
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
  if (!invocation) return false
  return Boolean(getToolResultRawContent(invocation).trim())
}

function buildStreamingInvocation(
  tool: AgentToolChainStreamingTool,
  index: number
): ToolInvocationLike | undefined {
  if (tool.result === undefined || tool.result === null) return undefined
  return {
    toolCallId: tool.toolCallId ?? `stream-${tool.name}-${index}`,
    toolName: tool.name,
    result: tool.result,
    args: tool.args
  }
}

function streamingToolKey(tool: AgentToolChainStreamingTool, index: number): string {
  return tool.toolCallId ?? `stream-done-${tool.name}-${tool.startTime ?? index}`
}

export function buildAgentToolChainItems(options: {
  invocations?: ToolInvocationLike[]
  completedTools?: AgentToolChainStreamingTool[]
  activeToolName?: string | null
  isToolError?: (invocation: ToolInvocationLike) => boolean
}): AgentToolChainItemModel[] {
  const items: AgentToolChainItemModel[] = []
  const indexByKey = new Map<string, number>()
  const isToolError = options.isToolError ?? (() => false)

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
      status: 'success',
      durationMs: tool.durationMs,
      invocation,
      hasContent: hasInvocationContent(invocation)
    })
  }

  if (options.activeToolName) {
    upsertItem({
      key: `stream-active-${options.activeToolName}`,
      toolName: options.activeToolName,
      status: 'loading',
      hasContent: false
    })
  }

  for (const [index, inv] of (options.invocations ?? []).entries()) {
    const key = inv.toolCallId || inv.toolName || `inv-${index}`
    upsertItem({
      key,
      toolName: inv.toolName || inv.toolCallId || 'tool',
      status: isToolError(inv) ? 'error' : 'success',
      invocation: inv,
      hasContent: hasInvocationContent(inv)
    })
  }

  return items
}
