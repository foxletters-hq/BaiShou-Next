import { describe, expect, it, vi } from 'vitest'
import {
  assertAsciiApiKey,
  createSanitizedFetch,
  ensureOpenCodeSessionHeaders,
  sanitizeRequestHeaders,
  toHttpHeaderByteString
} from '../fetch-header.util'

describe('fetch-header.util', () => {
  it('strips non-Latin-1 characters from header values', () => {
    expect(toHttpHeaderByteString('Bearer sk-test')).toBe('Bearer sk-test')
    expect(toHttpHeaderByteString('runtime/保')).toBe('runtime/')
    expect(toHttpHeaderByteString('ai-sdk/openai/3.0.50 runtime/保基')).toBe(
      'ai-sdk/openai/3.0.50 runtime/'
    )
  })

  it('sanitizes HeadersInit for fetch', () => {
    const headers = sanitizeRequestHeaders({
      Authorization: 'Bearer sk-abc',
      'User-Agent': 'test/保'
    })
    const normalized = new Headers(headers)
    expect(normalized.get('Authorization')).toBe('Bearer sk-abc')
    expect(normalized.get('User-Agent')).toBe('test/')
  })

  it('rejects api keys containing non-ASCII characters', () => {
    expect(() => assertAsciiApiKey('sk-valid')).not.toThrow()
    expect(() => assertAsciiApiKey('保sk-invalid')).toThrow(/non-ASCII/)
  })

  it('attaches stable x-opencode-session header for opencode.ai requests and forced OpenCode Go fetch', async () => {
    const turn1Init = ensureOpenCodeSessionHeaders(
      {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful coding assistant.' },
            { role: 'user', content: 'Fix the diary graph extraction bug' }
          ]
        })
      },
      { url: 'https://opencode.ai/zen/go/v1/chat/completions' }
    )
    const turn2Init = ensureOpenCodeSessionHeaders(
      {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful coding assistant. [epoch=2]' },
            { role: 'user', content: 'Fix the diary graph extraction bug' },
            { role: 'assistant', content: 'Sure, checking.' },
            { role: 'user', content: 'Continue' }
          ]
        })
      },
      { url: 'https://opencode.ai/zen/go/v1/chat/completions' }
    )

    const h1 = new Headers(turn1Init?.headers)
    const h2 = new Headers(turn2Init?.headers)
    expect(h1.get('x-opencode-session')).toMatch(/^sess-/)
    expect(h1.get('x-opencode-session')).toBe(h2.get('x-opencode-session'))
    expect(h1.get('user-agent')).toBe('baishou-agent/1.0')

    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const wrapped = createSanitizedFetch(mockFetch as unknown as typeof fetch)
    await wrapped('https://api.openai.com/v1/models')
    expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', undefined)
  })
})
