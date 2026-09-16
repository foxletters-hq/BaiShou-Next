import { estimateTextTokensApprox } from './text-token-estimate.util'

export type ContextOccupancySegmentId = 'conversation' | 'tools' | 'system'

export interface ContextOccupancySegment {
  id: ContextOccupancySegmentId
  tokens: number
}

export interface ContextOccupancyMessage {
  role?: string
  content?: string | null
  parts?: Array<{ type?: string; data?: unknown }>
}

export function lastRoundPromptTokens(usage: {
  inputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
}): number {
  return usage.inputTokens + usage.cacheReadInputTokens + usage.cacheWriteInputTokens
}

function textFromUnknown(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function textFromPart(part: { type?: string; data?: unknown }): string {
  const data = part.data
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data : ''
  const record = data as Record<string, unknown>
  if (part.type === 'tool') {
    return textFromUnknown(record.result ?? record.output ?? record.content ?? record.name)
  }
  if (typeof record.displayText === 'string' && record.displayText.trim()) {
    return record.displayText
  }
  return textFromUnknown(record.text)
}

function estimateMessageParts(message: ContextOccupancyMessage): {
  conversation: number
  tools: number
} {
  let conversation = 0
  let tools = 0
  const parts = message.parts ?? []
  if (parts.length > 0) {
    for (const part of parts) {
      const tokens = estimateTextTokensApprox(textFromPart(part))
      if (part.type === 'tool') tools += tokens
      else if (part.type === 'text' || part.type === 'context_snapshot') conversation += tokens
    }
    return { conversation, tools }
  }
  const tokens = estimateTextTokensApprox(
    typeof message.content === 'string' ? message.content : ''
  )
  if (message.role === 'tool') return { conversation: 0, tools: tokens }
  return { conversation: tokens, tools: 0 }
}

/** 按消息粗估对话 / 工具结果，余量归入系统与其它；再对齐上一轮提示总量。 */
export function estimateContextOccupancySegments(input: {
  lastRound: {
    inputTokens: number
    cacheReadInputTokens: number
    cacheWriteInputTokens: number
  } | null
  messages: readonly ContextOccupancyMessage[]
}): ContextOccupancySegment[] {
  if (!input.lastRound) return []
  const prompt = lastRoundPromptTokens(input.lastRound)
  if (prompt <= 0) return []

  let conversation = 0
  let tools = 0
  for (const message of input.messages) {
    const estimated = estimateMessageParts(message)
    conversation += estimated.conversation
    tools += estimated.tools
  }

  const raw = conversation + tools
  if (raw <= 0) return [{ id: 'system', tokens: prompt }]

  const scale = Math.min(1, prompt / raw)
  conversation = Math.round(conversation * scale)
  tools = Math.round(tools * scale)
  const system = Math.max(0, prompt - conversation - tools)

  const segments: ContextOccupancySegment[] = []
  if (conversation > 0) segments.push({ id: 'conversation', tokens: conversation })
  if (tools > 0) segments.push({ id: 'tools', tokens: tools })
  if (system > 0) segments.push({ id: 'system', tokens: system })
  return segments
}
