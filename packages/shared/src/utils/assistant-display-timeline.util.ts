import type { MockToolInvocation } from '../mock/agent.mock'
import { unwrapMessageMetadataForDisplay } from '../message-metadata'
import type { AgentStreamTimelineItem } from './agent-stream-timeline.util'
import { type AgentPartOrderLike, sortAgentMessageParts } from './agent-message-parts-order.util'
import { normalizePartData } from './message-attachment.util'

export type AssistantDisplayTimelineItem =
  | { kind: 'reasoning'; key: string; text: string }
  | { kind: 'text'; key: string; text: string }
  | {
      kind: 'tools'
      key: string
      invocations: MockToolInvocation[]
      completedTools: AssistantDisplayCompletedTool[]
      activeToolName?: string | null
      activeToolArgs?: unknown
    }

export type AssistantDisplayCompletedTool = {
  name: string
  durationMs: number
  toolCallId?: string
  result?: unknown
  args?: unknown
  error?: string
}

function readPartDisplayText(data: unknown): string {
  const normalized = normalizePartData(data)
  const display =
    typeof normalized.displayText === 'string' && normalized.displayText.trim()
      ? normalized.displayText
      : null
  const raw =
    display ??
    (typeof normalized.text === 'string'
      ? normalized.text
      : typeof normalized.content === 'string'
        ? normalized.content
        : '')
  return unwrapMessageMetadataForDisplay(String(raw ?? ''))
}

function streamToolToInvocation(
  item: Extract<AgentStreamTimelineItem, { kind: 'tool' }>
): MockToolInvocation {
  return {
    toolCallId: item.callId,
    toolName: item.name,
    state: item.status === 'completed' ? 'result' : 'call',
    args: item.arguments ?? {},
    result: item.result
  }
}

function streamToolsToGroup(
  key: string,
  items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>
): Extract<AssistantDisplayTimelineItem, { kind: 'tools' }> {
  const completed = items.filter((item) => item.status !== 'running')
  const running = items.find((item) => item.status === 'running')
  return {
    kind: 'tools',
    key,
    invocations: items.map(streamToolToInvocation),
    completedTools: completed.map((item) => ({
      name: item.name,
      durationMs: item.durationMs ?? 0,
      toolCallId: item.callId,
      result: item.result,
      args: item.arguments,
      error: item.status === 'failed' ? String(item.result ?? '') : undefined
    })),
    activeToolName: running?.name ?? null,
    activeToolArgs: running?.arguments
  }
}

function readPersistedToolDurationMs(data: Record<string, unknown>): number {
  const value = data.durationMs
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

function persistToolToInvocation(
  part: AgentPartOrderLike,
  data: Record<string, unknown>
): MockToolInvocation | null {
  const toolName =
    typeof data.name === 'string'
      ? data.name.trim()
      : typeof data.toolName === 'string'
        ? data.toolName.trim()
        : ''
  if (!toolName || toolName === 'emoji_send') return null
  const failed = data.status === 'failed'
  const awaitingAsk = toolName === 'companion_ask' && data.status === 'running' && !data.result
  return {
    toolCallId: String(data.callId ?? part.id ?? ''),
    toolName,
    state: failed ? 'call' : awaitingAsk ? 'partial-call' : 'result',
    args: (data.arguments as Record<string, unknown>) ?? {},
    result:
      data.result ?? data.error ?? (failed && !awaitingAsk ? 'Tool execution failed' : undefined)
  }
}

/** 流式时间线会就地追加，不能拿数组引用当缓存键 */
export function assistantStreamTimelineSignature(
  items: readonly AgentStreamTimelineItem[]
): string {
  return items
    .map((item) => {
      if (item.kind === 'tool') {
        return `tool:${item.callId}:${item.status}:${item.durationMs ?? ''}`
      }
      return `${item.kind}:${item.text.length}`
    })
    .join('|')
}

/** 相邻工具收成一组，思考和正文按发生顺序单独成段 */
export function groupStreamTimelineForDisplay(
  items: AgentStreamTimelineItem[]
): AssistantDisplayTimelineItem[] {
  const groups: AssistantDisplayTimelineItem[] = []
  let pendingTools: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>> = []

  const flushTools = () => {
    if (pendingTools.length === 0) return
    groups.push(streamToolsToGroup(`tools:${pendingTools[0]!.callId}`, pendingTools))
    pendingTools = []
  }

  for (const [index, item] of items.entries()) {
    if (item.kind === 'tool') {
      if (item.name === 'emoji_send') continue
      pendingTools.push(item)
      continue
    }
    flushTools()
    if (!item.text.trim()) continue
    groups.push({
      kind: item.kind,
      key: `${item.kind}:${index}`,
      text: item.text
    })
  }
  flushTools()
  return groups
}

/** 按 seq 展开落库 parts，再把相邻工具收成一组 */
export function buildAssistantDisplayTimelineFromParts(
  parts: AgentPartOrderLike[] | undefined
): AssistantDisplayTimelineItem[] {
  const items: AssistantDisplayTimelineItem[] = []
  let pendingTools: Array<{
    invocation: MockToolInvocation
    durationMs: number
  }> = []

  const flushTools = () => {
    if (pendingTools.length === 0) return
    const first = pendingTools[0]!.invocation
    items.push({
      kind: 'tools',
      key: `tools:${first.toolCallId || first.toolName}`,
      invocations: pendingTools.map((tool) => tool.invocation),
      completedTools: pendingTools.map((tool) => ({
        name: tool.invocation.toolName,
        durationMs: tool.durationMs,
        toolCallId: tool.invocation.toolCallId,
        result: tool.invocation.result,
        args: tool.invocation.args
      })),
      activeToolName: null
    })
    pendingTools = []
  }

  for (const part of sortAgentMessageParts(parts)) {
    if (part.type === 'text') {
      const data = normalizePartData(part.data)
      const text = readPartDisplayText(part.data)
      if (!text.trim()) continue
      flushTools()
      items.push({
        kind: data.isReasoning ? 'reasoning' : 'text',
        key: String(part.id ?? items.length),
        text
      })
      continue
    }
    if (part.type !== 'tool') continue
    const data = normalizePartData(part.data)
    const invocation = persistToolToInvocation(part, data)
    if (!invocation) continue
    pendingTools.push({
      invocation,
      durationMs: readPersistedToolDurationMs(data)
    })
  }
  flushTools()
  return items
}
