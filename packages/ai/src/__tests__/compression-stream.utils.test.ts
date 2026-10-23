import { describe, it, expect, vi, beforeEach } from 'vitest'
import { consumeCompressionModelStream } from '../agent/compression-stream.utils'
import * as lifecycle from '../agent/compression-lifecycle'

describe('consumeCompressionModelStream', () => {
  beforeEach(() => {
    vi.spyOn(lifecycle, 'emitCompressionLifecycle').mockImplementation(() => {})
  })

  it('emits native reasoning-delta and text-delta from fullStream', async () => {
    const chunks = [
      { type: 'reasoning-delta', textDelta: 'think ' },
      { type: 'text-delta', textDelta: 'summary ' },
      { type: 'text-delta', textDelta: 'done' }
    ]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          const value = chunks[index++]
          return { done: false, value }
        },
        releaseLock: () => {}
      })
    }

    const result = await consumeCompressionModelStream(
      {
        fullStream,
        textStream: (async function* () {})(),
        usage: Promise.resolve({ completionTokens: 12 })
      } as any,
      'sess-1'
    )

    expect(result.reasoningText).toBe('think ')
    expect(result.summaryText).toBe('summary done')
    expect(result.completionTokens).toBe(12)
    expect(lifecycle.emitCompressionLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reasoning-delta', chunk: 'think ' })
    )
    expect(lifecycle.emitCompressionLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'delta', chunk: 'summary done' })
    )
  })

  it('should mark first output on the first reasoning or text delta', async () => {
    const onFirstOutput = vi.fn()
    const chunks = [{ type: 'text-delta', textDelta: '摘要' }]
    let index = 0
    const fullStream = {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined }
          const value = chunks[index++]
          return { done: false, value }
        },
        releaseLock: () => {}
      })
    }

    await consumeCompressionModelStream(
      {
        fullStream,
        textStream: (async function* () {})(),
        usage: Promise.resolve({ completionTokens: 1 })
      } as any,
      'sess-1',
      undefined,
      { onFirstOutput }
    )

    expect(onFirstOutput).toHaveBeenCalledOnce()
  })
})
