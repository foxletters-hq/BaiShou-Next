import { AI_FIRST_OUTPUT_TIMEOUT_MS } from '@baishou/shared'
import { ChunkType } from './stream-chunk.types'

/** 等待模型首个输出（正文、推理或工具调用）的超时；收到后不再按墙钟中止 */
export const AGENT_STREAM_FIRST_OUTPUT_TIMEOUT_MS = AI_FIRST_OUTPUT_TIMEOUT_MS

export const AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME = 'TimeoutError'

export function createAgentFirstOutputTimeoutError(timeoutMs: number): Error {
  const error = new Error(
    `AI generation timeout: timed out after ${timeoutMs / 1000} seconds waiting for first output.`
  )
  error.name = AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME
  return error
}

export function isAgentFirstOutputTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return (
    name === AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME || message.includes('waiting for first output')
  )
}

export function isAgentStreamFirstOutputChunk(type: string | undefined): boolean {
  return (
    type === ChunkType.TEXT_DELTA ||
    type === ChunkType.REASONING_DELTA ||
    type === ChunkType.TOOL_CALL
  )
}

/** 超时中止会带上 abortSignal，但不能当成用户点停止 */
export function isAgentStreamUserAborted(input: {
  streamError: unknown
  abortSignalAborted: boolean
  doomTripped?: boolean
}): boolean {
  if (input.doomTripped) return false
  if (isAgentFirstOutputTimeoutError(input.streamError)) return false
  return input.abortSignalAborted
}

export async function runWithFirstOutputTimeout<T>(options: {
  timeoutMs: number
  abort: () => void
  run: (markFirstOutput: () => void) => Promise<T>
}): Promise<T> {
  const { timeoutMs, abort, run } = options
  if (timeoutMs <= 0) return run(() => undefined)

  let firstOutputSeen = false
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const waitingForFirstOutput = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      abort()
      reject(createAgentFirstOutputTimeoutError(timeoutMs))
    }, timeoutMs)
  })

  const markFirstOutput = () => {
    if (firstOutputSeen) return
    firstOutputSeen = true
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  try {
    const result = await Promise.race([run(markFirstOutput), waitingForFirstOutput])
    if (timedOut) throw createAgentFirstOutputTimeoutError(timeoutMs)
    return result
  } catch (error) {
    if (timedOut) throw createAgentFirstOutputTimeoutError(timeoutMs)
    throw error
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
