import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_STREAM_ABORT_ERROR_MESSAGE,
  createAgentStreamAbortError,
  isAgentStreamAbortError
} from '../agent-stream-abort.util'

describe('isAgentStreamAbortError', () => {
  it('detects AbortError by name', () => {
    const err = new DOMException('The operation was aborted', 'AbortError')
    expect(isAgentStreamAbortError(err)).toBe(true)
  })

  it('detects a plain Error named AbortError', () => {
    const err = new Error(AGENT_STREAM_ABORT_ERROR_MESSAGE)
    err.name = 'AbortError'
    expect(isAgentStreamAbortError(err)).toBe(true)
  })

  it('detects abort message text', () => {
    expect(isAgentStreamAbortError('The operation was aborted')).toBe(true)
    expect(isAgentStreamAbortError('This operation was aborted')).toBe(true)
    expect(isAgentStreamAbortError('BodyStreamBuffer was aborted')).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isAgentStreamAbortError(new Error('network failed'))).toBe(false)
    expect(isAgentStreamAbortError(new Error('模型未返回任何内容，请检查附件格式或稍后重试'))).toBe(
      false
    )
    expect(isAgentStreamAbortError("Property 'DOMException' doesn't exist")).toBe(false)
  })
})

describe('createAgentStreamAbortError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return AbortError when DOMException exists', () => {
    const err = createAgentStreamAbortError()
    expect(err.name).toBe('AbortError')
    expect(err.message).toBe(AGENT_STREAM_ABORT_ERROR_MESSAGE)
    expect(isAgentStreamAbortError(err)).toBe(true)
    expect(err).toBeInstanceOf(DOMException)
  })

  it('should return AbortError when DOMException is missing', () => {
    vi.stubGlobal('DOMException', undefined)
    const err = createAgentStreamAbortError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AbortError')
    expect(err.message).toBe(AGENT_STREAM_ABORT_ERROR_MESSAGE)
    expect(isAgentStreamAbortError(err)).toBe(true)
  })

  it('should return AbortError when DOMException constructor throws', () => {
    vi.stubGlobal(
      'DOMException',
      class {
        constructor() {
          throw new Error("Property 'DOMException' doesn't exist")
        }
      }
    )
    const err = createAgentStreamAbortError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AbortError')
    expect(isAgentStreamAbortError(err)).toBe(true)
  })
})
