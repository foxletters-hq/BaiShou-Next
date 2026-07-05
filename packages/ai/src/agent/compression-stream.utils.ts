import type { StreamTextResult } from 'ai'
import { emitCompressionLifecycle } from './compression-lifecycle'

export type CompressionStreamConsumeResult = {
  summaryText: string
  reasoningText: string
  completionTokens: number
  thoughtDurationMs: number
  summaryDurationMs: number
}

const COMPRESSION_EMIT_INTERVAL_MS = 80

function createCompressionEmitBatcher(sessionId: string) {
  let pendingReasoning = ''
  let pendingDelta = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    timer = undefined
    if (pendingReasoning) {
      const chunk = pendingReasoning
      pendingReasoning = ''
      emitCompressionLifecycle({ type: 'reasoning-delta', sessionId, chunk })
    }
    if (pendingDelta) {
      const chunk = pendingDelta
      pendingDelta = ''
      emitCompressionLifecycle({ type: 'delta', sessionId, chunk })
    }
  }

  return {
    pushReasoning(chunk: string) {
      pendingReasoning += chunk
      if (!timer) {
        timer = setTimeout(flush, COMPRESSION_EMIT_INTERVAL_MS)
      }
    },
    pushDelta(chunk: string) {
      pendingDelta += chunk
      if (!timer) {
        timer = setTimeout(flush, COMPRESSION_EMIT_INTERVAL_MS)
      }
    },
    flush,
    cancel() {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      pendingReasoning = ''
      pendingDelta = ''
    }
  }
}

function throwIfAborted(abortSignal?: AbortSignal): void {
  if (abortSignal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }
}

/**
 * 消费 Vercel AI SDK fullStream 原生 reasoning-delta / text-delta 事件。
 */
export async function consumeCompressionModelStream(
  streamResult: StreamTextResult<any, any>,
  sessionId: string,
  abortSignal?: AbortSignal
): Promise<CompressionStreamConsumeResult> {
  let summaryText = ''
  let reasoningText = ''
  const batcher = createCompressionEmitBatcher(sessionId)

  const startTime = Date.now()
  let hasReasoning = false
  let firstTextDeltaTime: number | null = null

  try {
    if (streamResult.fullStream) {
      const reader = streamResult.fullStream.getReader()
      try {
        while (true) {
          throwIfAborted(abortSignal)
          const { done, value } = await reader.read()
          if (done) break

          const part = value as { type: string; textDelta?: string; text?: string }
          switch (part.type) {
            case 'reasoning-delta': {
              const chunk = part.textDelta ?? part.text ?? ''
              if (!chunk) break
              hasReasoning = true
              reasoningText += chunk
              batcher.pushReasoning(chunk)
              break
            }
            case 'text-delta': {
              const chunk = part.textDelta ?? part.text ?? ''
              if (!chunk) break
              if (firstTextDeltaTime === null) {
                firstTextDeltaTime = Date.now()
              }
              summaryText += chunk
              batcher.pushDelta(chunk)
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
        throwIfAborted(abortSignal)
        if (!chunk) continue
        if (firstTextDeltaTime === null) {
          firstTextDeltaTime = Date.now()
        }
        summaryText += chunk
        batcher.pushDelta(chunk)
      }
    }
  } catch (e) {
    batcher.cancel()
    throw e
  }

  batcher.flush()

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
    (usage as { completionTokens?: number; outputTokens?: number } | undefined)?.completionTokens ??
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
