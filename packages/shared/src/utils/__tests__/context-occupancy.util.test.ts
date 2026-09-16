import { describe, expect, it } from 'vitest'
import {
  estimateContextOccupancySegments,
  lastRoundPromptTokens
} from '../context-occupancy.util'

describe('lastRoundPromptTokens', () => {
  it('should sum uncached input and cache tokens', () => {
    expect(
      lastRoundPromptTokens({
        inputTokens: 100,
        cacheReadInputTokens: 40,
        cacheWriteInputTokens: 10
      })
    ).toBe(150)
  })
})

describe('estimateContextOccupancySegments', () => {
  it('should return empty when there is no last-round prompt', () => {
    expect(estimateContextOccupancySegments({ lastRound: null, messages: [] })).toEqual([])
    expect(
      estimateContextOccupancySegments({
        lastRound: { inputTokens: 0, cacheReadInputTokens: 0, cacheWriteInputTokens: 0 },
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).toEqual([])
  })

  it('should put leftover prompt tokens into system when messages are empty', () => {
    expect(
      estimateContextOccupancySegments({
        lastRound: { inputTokens: 900, cacheReadInputTokens: 100, cacheWriteInputTokens: 0 },
        messages: []
      })
    ).toEqual([{ id: 'system', tokens: 1000 }])
  })

  it('should split conversation and tools then keep the remainder as system', () => {
    const helloTokens = Math.ceil('hello world'.length / 3)
    const toolTokens = Math.ceil('tool-output'.length / 3)
    const segments = estimateContextOccupancySegments({
      lastRound: {
        inputTokens: helloTokens + toolTokens + 50,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0
      },
      messages: [
        { role: 'user', content: 'hello world' },
        { role: 'tool', content: 'tool-output' }
      ]
    })
    expect(segments).toEqual([
      { id: 'conversation', tokens: helloTokens },
      { id: 'tools', tokens: toolTokens },
      { id: 'system', tokens: 50 }
    ])
  })

  it('should scale message estimates down when they exceed the prompt total', () => {
    const segments = estimateContextOccupancySegments({
      lastRound: { inputTokens: 10, cacheReadInputTokens: 0, cacheWriteInputTokens: 0 },
      messages: [{ role: 'user', content: 'a'.repeat(300) }]
    })
    const conversation = segments.find((segment) => segment.id === 'conversation')
    expect(conversation?.tokens).toBe(10)
    expect(segments.some((segment) => segment.id === 'system')).toBe(false)
  })
})
