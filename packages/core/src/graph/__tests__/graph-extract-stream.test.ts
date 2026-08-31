import { describe, expect, it, vi } from 'vitest'
import {
  collectGraphExtractStreamText,
  resolveGraphExtractLlmText
} from '../graph-llm-extraction.service'

async function* iterateParts(parts: unknown[]) {
  for (const part of parts) {
    yield part
  }
}

describe('collectGraphExtractStreamText', () => {
  it('reports reasoning before text from fullStream', async () => {
    const onDelta = vi.fn()
    const onReasoning = vi.fn()
    const text = await collectGraphExtractStreamText({
      fullStream: iterateParts([
        { type: 'reasoning-delta', text: '先想' },
        { type: 'text-delta', text: '{"ok":true}' }
      ]),
      onDelta,
      onReasoning
    })
    expect(text).toBe('{"ok":true}')
    expect(onReasoning).toHaveBeenCalledWith(2)
    expect(onDelta).toHaveBeenCalledWith(11)
  })

  it('reports textStream deltas', async () => {
    const onDelta = vi.fn()
    const text = await collectGraphExtractStreamText({
      textStream: iterateParts(['{"a":', '1}']) as AsyncIterable<string>,
      onDelta
    })
    expect(text).toBe('{"a":1}')
    expect(onDelta.mock.calls.map((call) => call[0])).toEqual([5, 7])
  })

  it('calls onDelta once when only the final text is available', async () => {
    const onDelta = vi.fn()
    const text = await collectGraphExtractStreamText({
      textPromise: Promise.resolve('{"done":true}'),
      onDelta
    })
    expect(text).toBe('{"done":true}')
    expect(onDelta).toHaveBeenCalledTimes(1)
    expect(onDelta).toHaveBeenCalledWith(13)
  })
})

describe('resolveGraphExtractLlmText', () => {
  it('falls back to the final text when the stream has no text-delta', async () => {
    const onDelta = vi.fn()
    const text = await resolveGraphExtractLlmText({
      fullStream: iterateParts([{ type: 'start' }, { type: 'finish' }]),
      textPromise: Promise.resolve('{"entities":[],"edges":[]}'),
      onDelta
    })
    expect(text).toBe('{"entities":[],"edges":[]}')
    expect(onDelta).toHaveBeenCalledWith(26)
  })

  it('keeps stream text when text-delta is present', async () => {
    const text = await resolveGraphExtractLlmText({
      fullStream: iterateParts([{ type: 'text-delta', text: '{"ok":1}' }]),
      textPromise: Promise.resolve('ignored')
    })
    expect(text).toBe('{"ok":1}')
  })

  it('reads nested text on text-delta parts', async () => {
    const text = await collectGraphExtractStreamText({
      fullStream: iterateParts([{ type: 'text-delta', delta: { text: '{"nested":true}' } }])
    })
    expect(text).toBe('{"nested":true}')
  })
})
