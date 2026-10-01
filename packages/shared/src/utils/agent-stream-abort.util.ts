/** 用户主动停止 Agent 流式输出（AbortController / AbortError） */
export const AGENT_STREAM_ABORT_ERROR_MESSAGE = 'The operation was aborted'

type DomExceptionConstructor = new (message?: string, name?: string) => Error

function getDomExceptionConstructor(): DomExceptionConstructor | undefined {
  const ctor = (globalThis as { DOMException?: unknown }).DOMException
  return typeof ctor === 'function' ? (ctor as DomExceptionConstructor) : undefined
}

/** Hermes 没有 DOMException；必须经 globalThis 取值，不能写裸标识符。 */
export function createAgentStreamAbortError(message = AGENT_STREAM_ABORT_ERROR_MESSAGE): Error {
  const Ctor = getDomExceptionConstructor()
  if (Ctor) {
    try {
      const err = new Ctor(message, 'AbortError')
      if (err.name !== 'AbortError') err.name = 'AbortError'
      return err
    } catch {
      // 构造签名不可用时退回 Error
    }
  }
  const err = new Error(message)
  err.name = 'AbortError'
  return err
}

export function isAgentStreamAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  ) {
    return true
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  const lower = message.toLowerCase()
  return (
    lower.includes('the operation was aborted') ||
    lower.includes('operation was aborted') ||
    lower.includes('this operation was aborted') ||
    lower.includes('request was aborted') ||
    lower.includes('response aborted') ||
    lower.includes('bodystreambuffer was aborted') ||
    lower.includes('stream aborted') ||
    lower.includes('aborted by the user') ||
    lower === 'aborted' ||
    lower === 'abort' ||
    message.includes('用户取消') ||
    message.includes('流已中止')
  )
}
