/** Hermes 没有 AbortSignal.timeout，直接调用会抛 timeout is not a function。 */
export function createAbortTimeoutSignal(timeoutMs: number): AbortSignal {
  if (
    typeof AbortSignal !== 'undefined' &&
    'timeout' in AbortSignal &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}
