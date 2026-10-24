import { describe, it, expect } from 'vitest'
import { buildLanguageModelMiddlewares } from '../middleware-factory'

describe('buildLanguageModelMiddlewares reasoning extraction', () => {
  it('includes extractReasoningMiddleware for minimax provider', () => {
    const middlewares = buildLanguageModelMiddlewares({ providerType: 'minimax' })
    // Midlewares include textSafety (0), promptCaching (1), and reasoningExtraction (2)
    expect(middlewares.length).toBeGreaterThanOrEqual(3)
  })

  it('includes extractReasoningMiddleware for other compatible providers like siliconflow and dashscope', () => {
    const sfMiddlewares = buildLanguageModelMiddlewares({ providerType: 'siliconflow' })
    expect(sfMiddlewares.length).toBeGreaterThanOrEqual(3)

    const dsMiddlewares = buildLanguageModelMiddlewares({ providerType: 'dashscope' })
    expect(dsMiddlewares.length).toBeGreaterThanOrEqual(3)
  })

  it('does not include extractReasoningMiddleware for native anthropic or gemini providers', () => {
    const anthropicMiddlewares = buildLanguageModelMiddlewares({ providerType: 'anthropic' })
    // Only textSafety and promptCaching
    expect(anthropicMiddlewares.length).toBe(2)

    const geminiMiddlewares = buildLanguageModelMiddlewares({ providerType: 'gemini' })
    expect(geminiMiddlewares.length).toBe(2)
  })
})
