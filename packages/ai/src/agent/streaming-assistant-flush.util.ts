export const STREAMING_ASSISTANT_FLUSH_IDLE_MS = 1500

export type StreamingAssistantFlushReason = 'token' | 'tool' | 'step' | 'final'

export function shouldFlushStreamingAssistant(input: {
  reason: StreamingAssistantFlushReason
  hasNewContentSinceFlush: boolean
  lastFlushAt: number | null
  now: number
  idleMs?: number
}): boolean {
  if (!input.hasNewContentSinceFlush) return false
  if (input.reason === 'final' || input.reason === 'tool' || input.reason === 'step') return true
  if (input.lastFlushAt == null) return true
  return input.now - input.lastFlushAt >= (input.idleMs ?? STREAMING_ASSISTANT_FLUSH_IDLE_MS)
}

export function flushReasonFromStreamChunk(type: string): StreamingAssistantFlushReason | null {
  if (type === 'text-delta' || type === 'reasoning-delta') return 'token'
  if (type === 'tool-call' || type === 'tool-result') return 'tool'
  if (type === 'step-finish') return 'step'
  return null
}

export function streamingAssistantSnapshotKey(input: {
  text: string
  reasoning: string
  toolCount: number
  fileChangeCount: number
  gateCount: number
}): string {
  return `${input.text.length}:${input.reasoning.length}:${input.toolCount}:${input.fileChangeCount}:${input.gateCount}`
}
