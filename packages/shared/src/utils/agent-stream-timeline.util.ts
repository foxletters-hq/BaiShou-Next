/** 流式 / 落库共用的助手时间线片段 */
export type AgentStreamTimelineItem =
  | { kind: 'reasoning'; text: string }
  | { kind: 'text'; text: string }
  | {
      kind: 'tool'
      callId: string
      name: string
      arguments?: unknown
      result?: unknown
      status: 'running' | 'completed' | 'failed'
      startTime?: number
      durationMs?: number
    }

export function appendTimelineReasoning(timeline: AgentStreamTimelineItem[], delta: string): void {
  if (!delta) return
  const last = timeline[timeline.length - 1]
  if (last?.kind === 'reasoning') {
    last.text += delta
    return
  }
  timeline.push({ kind: 'reasoning', text: delta })
}

export function appendTimelineText(timeline: AgentStreamTimelineItem[], delta: string): void {
  if (!delta) return
  const last = timeline[timeline.length - 1]
  if (last?.kind === 'text') {
    last.text += delta
    return
  }
  timeline.push({ kind: 'text', text: delta })
}

function hasMeaningfulToolArgs(args: unknown): boolean {
  if (typeof args === 'string') {
    const trimmed = args.trim()
    return trimmed.length > 0 && trimmed !== '{}'
  }
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    return Object.keys(args as Record<string, unknown>).length > 0
  }
  return args != null
}

export function appendTimelineToolStart(
  timeline: AgentStreamTimelineItem[],
  params: { callId: string; name: string; args?: unknown; startTime?: number }
): void {
  const existing = timeline.find(
    (item): item is Extract<AgentStreamTimelineItem, { kind: 'tool' }> =>
      item.kind === 'tool' && item.callId === params.callId
  )
  if (existing) {
    // 工具名先到时空参数是 {}，后面补上的问题不能被再一次空参数盖掉
    if (params.args !== undefined && hasMeaningfulToolArgs(params.args)) {
      existing.arguments = params.args
    }
    return
  }
  timeline.push({
    kind: 'tool',
    callId: params.callId,
    name: params.name,
    arguments: params.args,
    status: 'running',
    startTime: params.startTime ?? Date.now()
  })
}

export function completeTimelineTool(
  timeline: AgentStreamTimelineItem[],
  params: { callId?: string; name?: string; result?: unknown }
): void {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const item = timeline[i]
    if (item?.kind !== 'tool' || item.status !== 'running') continue
    if (params.callId && item.callId !== params.callId) continue
    if (!params.callId && params.name && item.name !== params.name) continue
    item.result = params.result
    item.status = 'completed'
    if (item.startTime) {
      item.durationMs = Date.now() - item.startTime
    }
    return
  }
}

export function joinTimelineReasoning(timeline: AgentStreamTimelineItem[]): string {
  return timeline
    .filter(
      (item): item is Extract<AgentStreamTimelineItem, { kind: 'reasoning' }> =>
        item.kind === 'reasoning'
    )
    .map((item) => item.text)
    .join('\n')
}

export function joinTimelineText(timeline: AgentStreamTimelineItem[]): string {
  return timeline
    .filter(
      (item): item is Extract<AgentStreamTimelineItem, { kind: 'text' }> => item.kind === 'text'
    )
    .map((item) => item.text)
    .join('')
}
