import { describe, it, expect } from 'vitest'
import type { ModelMessage } from 'ai'
import {
  ANTHROPIC_BREAKPOINT_CAP,
  INLINE_CACHE_PROVIDER_OPTIONS,
  applyInlineCacheMarkersToMessages,
  applyInlineCacheMarkersToSystem,
  applyInlineCacheMarkersToTools,
  buildPromptCacheProviderOptions,
  isClaudeModel,
  normalizePromptCacheKey,
  resolveCachingStrategy
} from '../middleware/prompt-caching.util'

describe('prompt-caching.util', () => {
  describe('resolveCachingStrategy', () => {
    it('enables inline markers for anthropic', () => {
      expect(resolveCachingStrategy({ providerType: 'anthropic', modelId: 'claude-3-5-sonnet' })).toEqual({
        inlineMarkers: true,
        promptCacheKey: false
      })
    })

    it('enables promptCacheKey for openai-compatible providers', () => {
      expect(
        resolveCachingStrategy({
          providerType: 'deepseek',
          modelId: 'deepseek-chat',
          sessionId: 'sess-1'
        })
      ).toEqual({
        inlineMarkers: false,
        promptCacheKey: true
      })
    })

    it('enables both for claude on openrouter', () => {
      expect(
        resolveCachingStrategy({
          providerType: 'openrouter',
          modelId: 'anthropic/claude-3.5-sonnet',
          sessionId: 'sess-1'
        })
      ).toEqual({
        inlineMarkers: true,
        promptCacheKey: true
      })
    })

    it('skips markers for gemini', () => {
      expect(resolveCachingStrategy({ providerType: 'gemini', modelId: 'gemini-2.5-flash' })).toEqual({
        inlineMarkers: false,
        promptCacheKey: false
      })
    })

    it('respects cachePolicy none', () => {
      expect(
        resolveCachingStrategy({
          providerType: 'anthropic',
          modelId: 'claude-3-5-sonnet',
          cachePolicy: 'none'
        })
      ).toEqual({
        inlineMarkers: false,
        promptCacheKey: false
      })
    })
  })

  describe('isClaudeModel', () => {
    it('detects claude model ids', () => {
      expect(isClaudeModel('anthropic/claude-sonnet-4')).toBe(true)
      expect(isClaudeModel('gpt-4o')).toBe(false)
    })
  })

  describe('normalizePromptCacheKey', () => {
    it('strips ses_ prefix and caps length', () => {
      expect(normalizePromptCacheKey('ses_abc123')).toBe('abc123')
      expect(normalizePromptCacheKey('x'.repeat(80)).length).toBe(64)
    })
  })

  describe('applyInlineCacheMarkersToSystem', () => {
    it('wraps string system prompt with cache providerOptions', () => {
      const result = applyInlineCacheMarkersToSystem('You are helpful', {
        providerType: 'anthropic',
        modelId: 'claude-3-5-sonnet'
      }) as { providerOptions: Record<string, unknown> }

      expect(result.providerOptions.anthropic).toEqual(INLINE_CACHE_PROVIDER_OPTIONS.anthropic)
    })
  })

  describe('applyInlineCacheMarkersToMessages', () => {
    it('marks latest user message for anthropic', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'second' }
      ]

      const result = applyInlineCacheMarkersToMessages(
        messages,
        { providerType: 'anthropic', modelId: 'claude-3-5-sonnet' },
        { remaining: ANTHROPIC_BREAKPOINT_CAP }
      )

      const lastUser = result[2] as { providerOptions?: Record<string, unknown> }
      expect(lastUser.providerOptions?.anthropic).toEqual(INLINE_CACHE_PROVIDER_OPTIONS.anthropic)
    })
  })

  describe('applyInlineCacheMarkersToTools', () => {
    it('marks last tool definition', () => {
      const tools = {
        search: { description: 'search', parameters: {} },
        memory: { description: 'memory', parameters: {} }
      }

      const result = applyInlineCacheMarkersToTools(
        tools,
        { providerType: 'anthropic', modelId: 'claude-3-5-sonnet' },
        { remaining: ANTHROPIC_BREAKPOINT_CAP }
      ) as Record<string, { providerOptions?: Record<string, unknown> }>

      expect(result.memory?.providerOptions?.anthropic).toEqual(INLINE_CACHE_PROVIDER_OPTIONS.anthropic)
      expect(result.search?.providerOptions).toBeUndefined()
    })
  })

  describe('buildPromptCacheProviderOptions', () => {
    it('sets openai promptCacheKey by default', () => {
      expect(
        buildPromptCacheProviderOptions({ providerType: 'openai', modelId: 'gpt-4o' }, 'session-1')
      ).toEqual({
        openai: { promptCacheKey: 'session-1', store: false }
      })
    })

    it('adds openrouter key for openrouter provider', () => {
      const opts = buildPromptCacheProviderOptions(
        { providerType: 'openrouter', modelId: 'gpt-4o' },
        'session-1'
      )
      expect(opts.openrouter).toEqual({ prompt_cache_key: 'session-1' })
    })
  })
})
