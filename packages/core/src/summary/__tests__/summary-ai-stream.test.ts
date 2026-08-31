import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectSummaryStreamText,
  createSummaryFirstOutputTimeoutError,
  isSummaryFirstOutputTimeoutError,
  isSummaryModelOutputPart,
  isSummaryUserAbortError,
  suppressUnusedSummaryStreamSettlements
} from '../summary-ai-stream'

function createFullStream(
  parts: Array<{ delayMs?: number; value?: unknown; done?: boolean }>
): {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: unknown }>
    releaseLock: () => void
  }
} {
  let index = 0
  return {
    getReader: () => ({
      read: async () => {
        const next = parts[index++]
        if (!next || next.done) return { done: true, value: undefined }
        if (next.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, next.delayMs))
        }
        return { done: false, value: next.value }
      },
      releaseLock: () => {}
    })
  }
}

function createHangingFullStream(): {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: unknown }>
    releaseLock: () => void
  }
} {
  return {
    getReader: () => ({
      read: () => new Promise(() => undefined),
      releaseLock: () => {}
    })
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('isSummaryModelOutputPart', () => {
  it('accepts non-empty text and reasoning deltas', () => {
    expect(isSummaryModelOutputPart({ type: 'text-delta', text: 'a' })).toBe(true)
    expect(isSummaryModelOutputPart({ type: 'reasoning-delta', textDelta: 'think' })).toBe(true)
    expect(isSummaryModelOutputPart({ type: 'reasoning', text: 'think' })).toBe(true)
  })

  it('rejects start events and empty deltas', () => {
    expect(isSummaryModelOutputPart({ type: 'start' })).toBe(false)
    expect(isSummaryModelOutputPart({ type: 'text-delta', text: '' })).toBe(false)
  })
})

describe('summary first-output timeout classification', () => {
  it('uses TimeoutError instead of AbortError', () => {
    const error = createSummaryFirstOutputTimeoutError(300_000)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toContain('timeout')
    expect(error.message).toContain('timed out')
    expect(isSummaryFirstOutputTimeoutError(error)).toBe(true)
    expect(isSummaryUserAbortError(error)).toBe(false)
  })

  it('does not treat first-output timeout as user abort even if the name is AbortError', () => {
    const error = new Error('AI generation timed out after 120 seconds waiting for first output.')
    error.name = 'AbortError'
    expect(isSummaryFirstOutputTimeoutError(error)).toBe(true)
    expect(isSummaryUserAbortError(error)).toBe(false)
  })

  it('treats AbortError as user abort when the user signal is aborted', () => {
    const abortController = new AbortController()
    abortController.abort()
    const error = new DOMException('The operation was aborted', 'AbortError')
    expect(isSummaryUserAbortError(error, abortController.signal)).toBe(true)
  })
})

describe('collectSummaryStreamText', () => {
  it('concatenates text-delta and ignores reasoning text', async () => {
    const onFirstOutput = vi.fn()
    const text = await collectSummaryStreamText({
      fullStream: createFullStream([
        { value: { type: 'start' } },
        { value: { type: 'reasoning-delta', textDelta: 'think ' } },
        { value: { type: 'text-delta', text: 'hello ' } },
        { value: { type: 'text-delta', textDelta: 'world' } }
      ]),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 1_000,
      onFirstOutput
    })

    expect(text).toBe('hello world')
    expect(onFirstOutput).toHaveBeenCalledTimes(1)
  })

  it('forwards reasoning and text deltas without mixing them into the answer', async () => {
    const onTextDelta = vi.fn()
    const onReasoningDelta = vi.fn()
    const text = await collectSummaryStreamText({
      fullStream: createFullStream([
        { value: { type: 'reasoning-delta', textDelta: '先想 ' } },
        { value: { type: 'reasoning-delta', text: '一步' } },
        { value: { type: 'text-delta', text: '结论' } }
      ]),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 1_000,
      onTextDelta,
      onReasoningDelta
    })
    expect(text).toBe('结论')
    expect(onReasoningDelta).toHaveBeenLastCalledWith('先想 一步')
    expect(onTextDelta).toHaveBeenLastCalledWith('结论')
  })

  it('times out when the first model output never arrives', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const promise = collectSummaryStreamText({
      fullStream: createFullStream([
        { value: { type: 'start' } },
        { delayMs: 5_000, value: { type: 'text-delta', text: 'late' } }
      ]),
      abortController,
      firstOutputTimeoutMs: 20
    })

    const assertion = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
      message: expect.stringContaining('waiting for first output')
    })
    await vi.advanceTimersByTimeAsync(20)
    await assertion
    expect(abortController.signal.aborted).toBe(true)
  })

  it('prefers first-output timeout over abort rejection from the reader', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const promise = collectSummaryStreamText({
      fullStream: {
        getReader: () => ({
          read: () =>
            new Promise((_, reject) => {
              abortController.signal.addEventListener(
                'abort',
                () => {
                  reject(new DOMException('The operation was aborted', 'AbortError'))
                },
                { once: true }
              )
            }),
          releaseLock: () => {}
        })
      },
      abortController,
      firstOutputTimeoutMs: 20
    })

    const assertion = expect(promise).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(20)
    await assertion
  })

  it('does not time out after the first output arrives', async () => {
    vi.useFakeTimers()
    const promise = collectSummaryStreamText({
      fullStream: createFullStream([
        { delayMs: 5, value: { type: 'text-delta', text: 'hello' } },
        { delayMs: 80, value: { type: 'text-delta', text: ' world' } }
      ]),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 30
    })

    await vi.advanceTimersByTimeAsync(5)
    await vi.advanceTimersByTimeAsync(80)
    await expect(promise).resolves.toBe('hello world')
  })

  it('treats reasoning-delta as first output and then waits for text', async () => {
    vi.useFakeTimers()
    const promise = collectSummaryStreamText({
      fullStream: createFullStream([
        { delayMs: 5, value: { type: 'reasoning-delta', text: 'think' } },
        { delayMs: 80, value: { type: 'text-delta', text: 'done' } }
      ]),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 30
    })

    await vi.advanceTimersByTimeAsync(5)
    await vi.advanceTimersByTimeAsync(80)
    await expect(promise).resolves.toBe('done')
  })

  it('returns empty string when the stream ends without output', async () => {
    const text = await collectSummaryStreamText({
      fullStream: createFullStream([{ value: { type: 'start' } }]),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 1_000
    })

    expect(text).toBe('')
  })

  it('collects textStream chunks when fullStream is absent', async () => {
    vi.useFakeTimers()
    async function* chunks() {
      yield 'foo'
      await new Promise((resolve) => setTimeout(resolve, 80))
      yield 'bar'
    }

    const promise = collectSummaryStreamText({
      textStream: chunks(),
      abortController: new AbortController(),
      firstOutputTimeoutMs: 30
    })

    await vi.advanceTimersByTimeAsync(80)
    await expect(promise).resolves.toBe('foobar')
  })

  it('aborts immediately when abortController is aborted before first output', async () => {
    const abortController = new AbortController()
    const promise = collectSummaryStreamText({
      fullStream: createHangingFullStream(),
      abortController,
      firstOutputTimeoutMs: 30_000
    })

    abortController.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('throws when the stream emits an error part', async () => {
    await expect(
      collectSummaryStreamText({
        fullStream: createFullStream([{ value: { type: 'error', error: new Error('provider down') } }]),
        abortController: new AbortController(),
        firstOutputTimeoutMs: 1_000
      })
    ).rejects.toThrow('provider down')
  })

  it('throws AbortError when the stream emits an abort part', async () => {
    await expect(
      collectSummaryStreamText({
        fullStream: createFullStream([{ value: { type: 'abort' } }]),
        abortController: new AbortController(),
        firstOutputTimeoutMs: 1_000
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('suppressUnusedSummaryStreamSettlements', () => {
  it('swallows unused text and usage rejections', async () => {
    const text = Promise.reject(new Error('stream text failed'))
    const usage = Promise.reject(new Error('usage failed'))
    suppressUnusedSummaryStreamSettlements({ text, usage })
    await Promise.resolve()
    await Promise.resolve()
  })
})
