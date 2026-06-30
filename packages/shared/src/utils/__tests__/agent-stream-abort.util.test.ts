import { describe, it, expect } from 'vitest'
import { isAgentStreamAbortError } from '../agent-stream-abort.util'

describe('isAgentStreamAbortError', () => {
  it('detects AbortError by name', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    expect(isAgentStreamAbortError(err)).toBe(true)
  })

  it('detects abort message text', () => {
    expect(isAgentStreamAbortError('The operation was aborted')).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isAgentStreamAbortError(new Error('network failed'))).toBe(false)
  })
})
