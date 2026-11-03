import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL_CONTEXT_WINDOW,
  applyModelContextWindowRuntimeOverlay,
  extractModelContextWindowsFromModelsDev,
  getModelContextWindow,
  resetModelContextWindowRuntimeOverlayForTests
} from '../model-context-window.util'

describe('getModelContextWindow', () => {
  afterEach(() => {
    resetModelContextWindowRuntimeOverlayForTests()
  })

  it('maps known models and defaults otherwise', () => {
    expect(getModelContextWindow('deepseek-v4-flash')).toBe(1_000_000)
    expect(getModelContextWindow('deepseek-flash')).toBe(1_000_000)
    expect(getModelContextWindow('deepseek-chat')).toBe(128_000)
    expect(getModelContextWindow('deepseek-coder')).toBe(64_000)
    expect(getModelContextWindow('claude-3-5-sonnet')).toBe(200_000)
    expect(getModelContextWindow('gpt-4o-mini')).toBe(128_000)
    expect(getModelContextWindow('some-unknown-model')).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
    expect(getModelContextWindow(undefined)).toBe(DEFAULT_MODEL_CONTEXT_WINDOW)
  })

  it('correctly identifies grok family models', () => {
    // 500k frontier models
    expect(getModelContextWindow('grok-4.7')).toBe(500_000)
    expect(getModelContextWindow('grok4.7')).toBe(500_000)
    expect(getModelContextWindow('xai/grok-4.7')).toBe(500_000)
    expect(getModelContextWindow('opencode-go/grok-4.7')).toBe(500_000)
    expect(getModelContextWindow('grok-4.6')).toBe(500_000)
    expect(getModelContextWindow('grok-4.5')).toBe(500_000)
    expect(getModelContextWindow('grok-latest')).toBe(500_000)

    // 1M / 2M variants
    expect(getModelContextWindow('grok-4.3')).toBe(1_000_000)
    expect(getModelContextWindow('grok-4.20-reasoning')).toBe(2_000_000)
    expect(getModelContextWindow('grok-4.1-fast')).toBe(2_000_000)
    expect(getModelContextWindow('grok-4-fast')).toBe(2_000_000)

    // 256k & 128k variants
    expect(getModelContextWindow('grok-build-0.1')).toBe(256_000)
    expect(getModelContextWindow('grok-code')).toBe(256_000)
    expect(getModelContextWindow('grok-4')).toBe(256_000)
    expect(getModelContextWindow('grok-3')).toBe(131_072)
    expect(getModelContextWindow('grok-3-mini')).toBe(131_072)
    expect(getModelContextWindow('grok-2')).toBe(131_072)
  })

  it('maps extended long context models', () => {
    expect(getModelContextWindow('gemini-1.5-pro')).toBe(2_000_000)
    expect(getModelContextWindow('gemini-2.5-flash')).toBe(1_000_000)
    expect(getModelContextWindow('qwen-long')).toBe(1_000_000)
    expect(getModelContextWindow('glm-4-long')).toBe(1_000_000)
    expect(getModelContextWindow('minimax-text-01')).toBe(1_000_000)
    expect(getModelContextWindow('abab6.5s')).toBe(245_760)
  })

  it('prefers a positive override over the model table', () => {
    expect(getModelContextWindow('deepseek-chat', 32_000)).toBe(32_000)
    expect(getModelContextWindow('deepseek-chat', 0)).toBe(128_000)
    expect(getModelContextWindow('deepseek-chat', null)).toBe(128_000)
  })

  it('extracts context windows from models.dev data and applies runtime overlay', () => {
    const mockModelsDev = {
      xai: {
        models: {
          'brand-new-frontier': {
            limit: { context: 800_000, output: 8000 }
          },
          'xai/custom-grok': {
            limit: { context: 600_000, output: 8000 }
          }
        }
      }
    }

    const extracted = extractModelContextWindowsFromModelsDev(mockModelsDev)
    expect(extracted['brand-new-frontier']).toBe(800_000)
    expect(extracted['custom-grok']).toBe(600_000)

    applyModelContextWindowRuntimeOverlay(extracted)

    expect(getModelContextWindow('brand-new-frontier')).toBe(800_000)
    expect(getModelContextWindow('custom-grok')).toBe(600_000)
    expect(getModelContextWindow('some-provider/custom-grok')).toBe(600_000)
  })
})
