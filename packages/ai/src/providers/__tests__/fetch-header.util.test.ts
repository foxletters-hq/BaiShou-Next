import { describe, expect, it } from 'vitest'
import {
  assertAsciiApiKey,
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
})
