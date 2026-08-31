import { sanitizeAssistantGeneratedText } from '@baishou/shared'
import type { StreamAccumulator, StreamTimelineItem } from './stream-accumulator'
import { sanitizeToolPayloadForStorage } from './session-tool-payload-sanitizer'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export type TimelinePersistPart = {
  id: string
  messageId: string
  sessionId: string
  type: 'text' | 'tool'
  data: Record<string, unknown>
}

/**
 * 按时间线顺序把 reasoning / tool / text 落成 parts（带 seq，便于读取排序）。
 * emoji 等前置 parts 由调用方先放入再 concat。
 */
export function buildAssistantPartsFromTimeline(params: {
  accumulator: StreamAccumulator
  assistantMsgId: string
  sessionId: string
  startSeq?: number
}): TimelinePersistPart[] {
  const { accumulator, assistantMsgId, sessionId } = params
  let seq = params.startSeq ?? 0
  const parts: TimelinePersistPart[] = []
  const timeline = accumulator.timeline

  const pushTextSegment = (text: string, isReasoning: boolean) => {
    const trimmed = text.trim()
    if (!trimmed && !text) return
    const content = isReasoning ? text : sanitizeAssistantGeneratedText(text)
    if (!content.trim()) return
    parts.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: {
        text: content,
        ...(isReasoning ? { isReasoning: true } : {}),
        seq: seq++
      }
    })
  }

  if (timeline.length === 0) {
    // 兼容旧路径：无 timeline 时按 思考 → 工具 → 正文 落盘（勿把正文放最前）
    if (accumulator.reasoning.trim()) pushTextSegment(accumulator.reasoning, true)
    for (const tc of accumulator.toolCalls) {
      if (!tc?.callId || !tc?.name || tc.name === 'emoji_send') continue
      const resultObj = accumulator.toolResults.find((tr) => tr.callId === tc.callId)
      const toolData = sanitizeToolPayloadForStorage({
        callId: tc.callId,
        name: tc.name,
        arguments: tc.arguments,
        result: resultObj?.result,
        status: resultObj ? 'completed' : 'failed'
      })
      parts.push({
        id: generateUUID(),
        messageId: assistantMsgId,
        sessionId,
        type: 'tool',
        data: { ...(toolData as Record<string, unknown>), seq: seq++ }
      })
    }
    const text = sanitizeAssistantGeneratedText(accumulator.text)
    if (text.trim()) pushTextSegment(text, false)
    return parts
  }

  for (const item of timeline as StreamTimelineItem[]) {
    if (item.kind === 'reasoning') {
      pushTextSegment(item.text, true)
      continue
    }
    if (item.kind === 'text') {
      pushTextSegment(item.text, false)
      continue
    }
    if (item.kind === 'tool') {
      if (!item.callId || !item.name || item.name === 'emoji_send') continue
      const toolData = sanitizeToolPayloadForStorage({
        callId: item.callId,
        name: item.name,
        arguments: item.arguments,
        result: item.result,
        status: item.status === 'running' ? 'failed' : item.status
      })
      parts.push({
        id: generateUUID(),
        messageId: assistantMsgId,
        sessionId,
        type: 'tool',
        data: { ...(toolData as Record<string, unknown>), seq: seq++ }
      })
    }
  }

  return parts
}
