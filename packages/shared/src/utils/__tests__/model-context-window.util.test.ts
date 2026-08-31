import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  getModelContextWindow
} from '../model-context-window.util'

describe('getModelContextWindow', () => {
  it('maps known models and defaults otherwise', () => {
    expect(getModelContextWindow('deepseek-v4-flash')).toBe(1_000_000)
    expect(getModelContextWindow('deepseek-chat')).toBe(128_000)
    expect(getModelContextWindow('deepseek-coder')).toBe(64_000)
    expect(getModelContextWindow('claude-3-5-sonnet')).toBe(200_000)
    expect(getModelContextWindow('gpt-4o-mini')).toBe(128_000)
    expect(getModelContextWindow('some-unknown-model')).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
    expect(getModelContextWindow(undefined)).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
  })

  it('prefers a positive override over the model table', () => {
    expect(getModelContextWindow('deepseek-chat', 32_000)).toBe(32_000)
    expect(getModelContextWindow('deepseek-chat', 0)).toBe(128_000)
    expect(getModelContextWindow('deepseek-chat', null)).toBe(128_000)
  })
})
