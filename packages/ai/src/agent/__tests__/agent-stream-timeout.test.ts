import { describe, expect, it, vi } from 'vitest'
import { ChunkType } from '../stream-chunk.types'
import {
  AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME,
  createAgentFirstOutputTimeoutError,
  isAgentFirstOutputTimeoutError,
  isAgentStreamFirstOutputChunk,
  isAgentStreamUserAborted,
  runWithFirstOutputTimeout
} from '../agent-stream-timeout'

describe('agent first-output timeout classification', () => {
  it('should recognize the timeout error by name and message', () => {
    const error = createAgentFirstOutputTimeoutError(1_000)
    expect(error.name).toBe(AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME)
    expect(isAgentFirstOutputTimeoutError(error)).toBe(true)
    expect(
      isAgentFirstOutputTimeoutError(
        new Error('AI generation timeout: timed out after 120 seconds waiting for first output.')
      )
    ).toBe(true)
    expect(isAgentFirstOutputTimeoutError(new DOMException('aborted', 'AbortError'))).toBe(false)
  })

  it('should treat text, reasoning and tool-call as first output', () => {
    expect(isAgentStreamFirstOutputChunk(ChunkType.TEXT_DELTA)).toBe(true)
    expect(isAgentStreamFirstOutputChunk(ChunkType.REASONING_DELTA)).toBe(true)
    expect(isAgentStreamFirstOutputChunk(ChunkType.TOOL_CALL)).toBe(true)
    expect(isAgentStreamFirstOutputChunk(ChunkType.TOOL_RESULT)).toBe(false)
    expect(isAgentStreamFirstOutputChunk(ChunkType.STEP_FINISH)).toBe(false)
  })

  it('should not treat first-output timeout as a user abort even if the signal aborted', () => {
    expect(
      isAgentStreamUserAborted({
        streamError: createAgentFirstOutputTimeoutError(1_000),
        abortSignalAborted: true
      })
    ).toBe(false)
    expect(
      isAgentStreamUserAborted({
        streamError: new DOMException('The operation was aborted', 'AbortError'),
        abortSignalAborted: true
      })
    ).toBe(true)
  })
})

describe('runWithFirstOutputTimeout', () => {
  it('should abort and throw when the first output never arrives', async () => {
    const abort = vi.fn()
    await expect(
      runWithFirstOutputTimeout({
        timeoutMs: 20,
        abort,
        run: () => new Promise(() => undefined)
      })
    ).rejects.toMatchObject({
      name: AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME,
      message: expect.stringContaining('waiting for first output')
    })
    expect(abort).toHaveBeenCalledOnce()
  })

  it('should keep running after the first output arrives', async () => {
    const abort = vi.fn()
    const result = await runWithFirstOutputTimeout({
      timeoutMs: 30,
      abort,
      run: async (markFirstOutput) => {
        markFirstOutput()
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'ok'
      }
    })
    expect(result).toBe('ok')
    expect(abort).not.toHaveBeenCalled()
  })

  it('should prefer timeout over a later abort rejection', async () => {
    const abort = vi.fn()
    await expect(
      runWithFirstOutputTimeout({
        timeoutMs: 20,
        abort,
        run: () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new DOMException('The operation was aborted', 'AbortError')), 40)
          })
      })
    ).rejects.toMatchObject({
      name: AGENT_FIRST_OUTPUT_TIMEOUT_ERROR_NAME
    })
  })
})
