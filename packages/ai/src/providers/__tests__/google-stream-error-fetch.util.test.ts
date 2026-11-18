import { describe, expect, it, vi } from 'vitest'
import {
  PROVIDER_CONTENT_FILTER_MESSAGE,
  isProviderContentFilterError,
  readProviderContentFilterDetail
} from '@baishou/shared'
import { wrapGoogleStreamErrorFetch } from '../google-stream-error-fetch.util'

function sseStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    }
  })
}

async function readAllStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out
}

describe('wrapGoogleStreamErrorFetch', () => {
  it('throws ProviderContentFilterError when SSE stream ends with promptFeedback.blockReason and no output', async () => {
    const baseFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          sseStreamFromChunks([
            'data: {"promptFeedback":{"blockReason":"PROHIBITED_CONTENT"},"usageMetadata":{"promptTokenCount":120}}\n\n'
          ]),
          { status: 200, headers: { 'content-type': 'text/event-stream' } }
        )
      )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    const response = await guardedFetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse'
    )

    let caught: unknown
    try {
      await readAllStreamText(response.body!)
    } catch (e) {
      caught = e
    }

    expect(isProviderContentFilterError(caught)).toBe(true)
    expect((caught as Error).message).toBe(PROVIDER_CONTENT_FILTER_MESSAGE)
    expect(readProviderContentFilterDetail(caught)).toContain('PROHIBITED_CONTENT')
  })

  it('surfaces upstream SSE error chunks split across UTF-8 byte boundaries', async () => {
    const encoder = new TextEncoder()
    const payloadBytes = encoder.encode(
      'data: {"error":{"code":429,"message":"配额已耗尽，请稍后再试"}}\n\n'
    )
    const splitAt = Math.floor(payloadBytes.length / 2)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payloadBytes.subarray(0, splitAt))
        controller.enqueue(payloadBytes.subarray(splitAt))
        controller.close()
      }
    })

    const baseFetch = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    const response = await guardedFetch(
      'https://proxy.example.com/v1beta/models/gemini:streamGenerateContent?alt=sse'
    )

    let caught: unknown
    try {
      await readAllStreamText(response.body!)
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toBe('配额已耗尽，请稍后再试')
    expect((caught as { statusCode?: number }).statusCode).toBe(429)
    expect(isProviderContentFilterError(caught)).toBe(false)
  })

  it('converts HTTP 200 JSON error or blocked promptFeedback into clear errors', async () => {
    const baseFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          promptFeedback: { blockReason: 'SAFETY' }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    await expect(
      guardedFetch('https://proxy.example.com/v1beta/models/gemini:streamGenerateContent?alt=sse')
    ).rejects.toThrow(PROVIDER_CONTENT_FILTER_MESSAGE)
  })

  it('catches raw JSON error returned under text/event-stream by relay proxies', async () => {
    const baseFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          sseStreamFromChunks([
            '{"error":{"code":400,"message":"Response blocked due to PROHIBITED_CONTENT"}}'
          ]),
          { status: 200, headers: { 'content-type': 'text/event-stream' } }
        )
      )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    const response = await guardedFetch(
      'https://proxy.example.com/v1beta/models/gemini:streamGenerateContent?alt=sse'
    )

    await expect(readAllStreamText(response.body!)).rejects.toThrow(PROVIDER_CONTENT_FILTER_MESSAGE)
  })

  it('passes through normal SSE text and multi-byte Chinese characters unchanged', async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"你好，"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"白守！"}]},"finishReason":"STOP"}]}\n\n'

    const baseFetch = vi.fn().mockResolvedValue(
      new Response(sseStreamFromChunks([sse.slice(0, 30), sse.slice(30)]), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    const response = await guardedFetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent?alt=sse'
    )

    const text = await readAllStreamText(response.body!)
    expect(text).toBe(sse)
  })

  it('lets partial-output content-filter streams finish so generated text can be preserved', async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"前半段回答"}]}}]}\n\n' +
      'data: {"candidates":[{"finishReason":"PROHIBITED_CONTENT"}]}\n\n'

    const baseFetch = vi.fn().mockResolvedValue(
      new Response(sseStreamFromChunks([sse]), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    )

    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)
    const response = await guardedFetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent?alt=sse'
    )

    const text = await readAllStreamText(response.body!)
    expect(text).toBe(sse)
  })

  it('passes non-generateContent requests directly through without buffering', async () => {
    const originalResponse = new Response(JSON.stringify({ models: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
    const baseFetch = vi.fn().mockResolvedValue(originalResponse)
    const guardedFetch = wrapGoogleStreamErrorFetch(baseFetch as unknown as typeof fetch)

    const result = await guardedFetch('https://generativelanguage.googleapis.com/v1beta/models')
    expect(result).toBe(originalResponse)
  })
})
