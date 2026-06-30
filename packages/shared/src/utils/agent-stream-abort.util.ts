/** 用户主动停止 Agent 流式输出（AbortController / DOMException AbortError） */
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
    lower === 'aborted'
  )
}
