import { describe, expect, it } from 'vitest'
import { consumeCompressionModelStream } from '../compression-stream.utils'

function createNoOutputError(): Error {
  return Object.assign(new Error('No output generated. Check the stream for errors.'), {
    name: 'AI_NoOutputGeneratedError',
    [Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')]: true
  })
}

describe('consumeCompressionModelStream', () => {
  it('accesses fullStream getter only once and falls back to 0 tokens when usage rejects with AI_NoOutputGeneratedError', async () => {
    let fullStreamGetterCalls = 0
    const chunks = [{ type: 'error', error: createNoOutputError() }]
    let index = 0
    const streamResult = {
      get fullStream() {
        fullStreamGetterCalls += 1
        return {
          getReader: () => ({
            read: async () => {
              if (index >= chunks.length) return { done: true, value: undefined }
              return { done: false, value: chunks[index++] }
            },
            releaseLock: () => {}
          })
        }
      },
      get usage() {
        return Promise.reject(createNoOutputError())
      }
    }

    const result = await consumeCompressionModelStream(streamResult as never, 'sess-1')
    expect(fullStreamGetterCalls).toBe(1)
    expect(result.summaryText).toBe('')
    expect(result.completionTokens).toBe(0)
  })

  it('throws normalized error when fullStream emits a non-benign error chunk', async () => {
    const chunks = [{ type: 'error', error: new Error('Rate limit exceeded') }]
    let index = 0
    const streamResult = {
      fullStream: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) return { done: true, value: undefined }
            return { done: false, value: chunks[index++] }
          },
          releaseLock: () => {}
        })
      },
      get usage() {
        return Promise.reject(createNoOutputError())
      }
    }

    await expect(consumeCompressionModelStream(streamResult as never, 'sess-1')).rejects.toThrow(
      'Rate limit exceeded'
    )
  })

  it('throws AbortError when fullStream emits an abort chunk', async () => {
    const chunks = [{ type: 'abort' }]
    let index = 0
    const streamResult = {
      fullStream: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) return { done: true, value: undefined }
            return { done: false, value: chunks[index++] }
          },
          releaseLock: () => {}
        })
      },
      get usage() {
        return Promise.reject(createNoOutputError())
      }
    }

    await expect(
      consumeCompressionModelStream(streamResult as never, 'sess-1')
    ).rejects.toMatchObject({
      name: 'AbortError'
    })
  })
})
