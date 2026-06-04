import type { StreamTextResult } from 'ai'
import { emitCompressionLifecycle } from './compression-lifecycle'

export type CompressionStreamConsumeResult = {
  summaryText: string
  reasoningText: string
  completionTokens: number
  thoughtDurationMs: number
  summaryDurationMs: number
}

/**
 * 消费 Vercel AI SDK fullStream 原生 reasoning-delta / text-delta 事件。
 */
export async function consumeCompressionModelStream(
  streamResult: StreamTextResult<any, any>,
  sessionId: string
): Promise<CompressionStreamConsumeResult> {
  let summaryText = ''
  let reasoningText = ''

  const startTime = Date.now()
  let hasReasoning = false
  let firstTextDeltaTime: number | null = null

  if (streamResult.fullStream) {
    const reader = streamResult.fullStream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const part = value as { type: string; textDelta?: string; text?: string }
        switch (part.type) {
          case 'reasoning-delta': {
            const chunk = part.textDelta ?? part.text ?? ''
            if (!chunk) break
            hasReasoning = true
            reasoningText += chunk
            emitCompressionLifecycle({ type: 'reasoning-delta', sessionId, chunk })
            break
          }
          case 'text-delta': {
            const chunk = part.textDelta ?? part.text ?? ''
            if (!chunk) break
            if (firstTextDeltaTime === null) {
              firstTextDeltaTime = Date.now()
            }
            summaryText += chunk
            emitCompressionLifecycle({ type: 'delta', sessionId, chunk })
            break
          }
          default:
            break
        }
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    for await (const chunk of streamResult.textStream) {
      if (!chunk) continue
      if (firstTextDeltaTime === null) {
        firstTextDeltaTime = Date.now()
      }
      summaryText += chunk
      emitCompressionLifecycle({ type: 'delta', sessionId, chunk })
    }
  }

  const endTime = Date.now()

  let thoughtDurationMs = 0
  let summaryDurationMs = 0

  if (hasReasoning) {
    if (firstTextDeltaTime !== null) {
      thoughtDurationMs = firstTextDeltaTime - startTime
      summaryDurationMs = endTime - firstTextDeltaTime
    } else {
      thoughtDurationMs = endTime - startTime
      summaryDurationMs = 0
    }
  } else {
    thoughtDurationMs = 0
    summaryDurationMs = endTime - startTime
  }

  const usage = await streamResult.usage
  const completionTokens =
    (usage as { completionTokens?: number; outputTokens?: number } | undefined)
      ?.completionTokens ??
    (usage as { outputTokens?: number } | undefined)?.outputTokens ??
    0

  return {
    summaryText,
    reasoningText,
    completionTokens,
    thoughtDurationMs,
    summaryDurationMs
  }
}

