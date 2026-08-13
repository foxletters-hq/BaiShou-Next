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

export function appendTimelineReasoning(
  timeline: AgentStreamTimelineItem[],
  delta: string
): void {
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

export function appendTimelineToolStart(
  timeline: AgentStreamTimelineItem[],
  params: { callId: string; name: string; args?: unknown; startTime?: number }
): void {
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
