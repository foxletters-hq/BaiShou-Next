import { describe, it, expect } from 'vitest'
import {
  estimateToolPayloadSize,
  isPrunedToolPayload,
  sanitizeToolPayloadForPrune,
  sanitizeToolPayloadForStorage
} from '../agent/session-tool-payload-sanitizer'

describe('session-tool-payload-sanitizer', () => {
  it('strips diary_write content but keeps metadata', () => {
    const content = 'x'.repeat(500)
    const input = {
      callId: 'c1',
      name: 'diary_write',
      arguments: { date: '2026-06-01', content, tags: 'life' },
      result: 'Successfully created diary entry for 2026-06-01.',
      status: 'completed'
    }

    const sanitized = sanitizeToolPayloadForPrune(input) as Record<string, unknown>
    const args = sanitized.arguments as Record<string, unknown>

    expect(args.content).toBeUndefined()
    expect(args.date).toBe('2026-06-01')
    expect(args.tags).toBe('life')
    expect(args.contentLength).toBe(500)
    expect(typeof args.contentPreview).toBe('string')
    expect(args.contentPruned).toBe(true)
    expect(isPrunedToolPayload(sanitized)).toBe(true)
  })

  it('strips diary_read result when over prune field limit', () => {
    const result = `## 2026-06-01\n\n${'正文'.repeat(20_000)}\n---\n\n## 2026-06-02\n\n短`
    const input = {
      callId: 'c2',
      name: 'diary_read',
      arguments: { dates: ['2026-06-01', '2026-06-02'] },
      result,
      status: 'completed'
    }

    const sanitized = sanitizeToolPayloadForPrune(input) as Record<string, unknown>
    expect(typeof sanitized.result).toBe('string')
    expect(sanitized.resultPreview).toBeDefined()
    expect(sanitized.resultLength).toBeGreaterThan(100)
    expect(sanitized.resultDates).toEqual(['2026-06-01', '2026-06-02'])
    expect(sanitized.resultPruned).toBe(true)
  })

  it('does not re-sanitize already pruned payload', () => {
    const input = {
      name: 'diary_write',
      arguments: { date: '2026-06-01', contentPreview: 'ok', contentPruned: true },
      result: 'ok'
    }
    expect(sanitizeToolPayloadForPrune(input)).toBe(input)
  })

  it('estimates payload size from arguments and result', () => {
    const size = estimateToolPayloadSize({
      arguments: { content: 'abc'.repeat(100) },
      result: 'ok'
    })
    expect(size).toBeGreaterThan(200)
  })

  it('sanitizeToolPayloadForStorage always slims diary_write content at persist', () => {
    const input = {
      callId: 'c-persist',
      name: 'diary_write',
      arguments: { date: '2026-06-01', content: 'short body' },
      result: 'Successfully created diary entry for 2026-06-01.',
      status: 'completed'
    }
    const stored = sanitizeToolPayloadForStorage(input) as Record<string, unknown>
    const args = stored.arguments as Record<string, unknown>
    expect(args.content).toBeUndefined()
    expect(args.contentPreview).toBe('short body')
    expect(args.contentPruned).toBe(true)
  })

  it('generic sanitizer removes large argument fields instead of keeping them', () => {
    const huge = 'z'.repeat(40 * 1024)
    const input = {
      name: 'custom_tool',
      arguments: { content: huge, path: '/tmp/a' },
      result: 'ok'
    }
    const sanitized = sanitizeToolPayloadForPrune(input) as Record<string, unknown>
    const args = sanitized.arguments as Record<string, unknown>
    expect(args.content).toBeUndefined()
    expect(args.contentPreview).toBeDefined()
    expect(args.path).toBe('/tmp/a')
    expect(args.argumentsPruned).toBe(true)
  })

  it('sanitizeToolPayloadForStorage keeps large tool result under store limit', () => {
    const largeResult = '网页正文'.repeat(3000)
    const input = {
      callId: 'c-url',
      name: 'url_read',
      arguments: { url: 'https://example.com' },
      result: largeResult,
      status: 'completed'
    }
    const stored = sanitizeToolPayloadForStorage(input) as Record<string, unknown>
    expect(stored.result).toBe(largeResult)
    expect(stored.resultPruned).toBeUndefined()
  })
})
