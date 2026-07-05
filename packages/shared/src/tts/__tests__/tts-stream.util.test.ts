import { describe, it, expect } from 'vitest'
import {
  resolveTtsStreamingEnabled,
  shouldUseTtsSynthesisCache,
  supportsTtsProviderStreaming
} from '../tts-stream.util'

describe('tts-stream.util', () => {
  it('supportsTtsProviderStreaming recognizes stream-capable providers', () => {
    expect(supportsTtsProviderStreaming('mimo-tts')).toBe(true)
    expect(supportsTtsProviderStreaming('minimax-tts')).toBe(true)
    expect(supportsTtsProviderStreaming('openai-tts')).toBe(false)
  })

  it('resolveTtsStreamingEnabled respects provider rules', () => {
    expect(resolveTtsStreamingEnabled('minimax-tts', true, 'speech-2.8-hd')).toBe(true)
    expect(resolveTtsStreamingEnabled('minimax-tts', false, 'speech-2.8-hd')).toBe(false)
    expect(resolveTtsStreamingEnabled('mimo-tts', true, 'mimo-v2.5-tts')).toBe(true)
    expect(resolveTtsStreamingEnabled('mimo-tts', true, 'mimo-v2.5-tts-voiceclone')).toBe(true)
    expect(resolveTtsStreamingEnabled('openai-tts', true)).toBe(false)
  })

  it('shouldUseTtsSynthesisCache disables cache for stream and mimo', () => {
    expect(shouldUseTtsSynthesisCache('mimo-tts', false)).toBe(false)
    expect(shouldUseTtsSynthesisCache('minimax-tts', true)).toBe(false)
    expect(shouldUseTtsSynthesisCache('minimax-tts', false)).toBe(true)
    expect(shouldUseTtsSynthesisCache('openai-tts', false)).toBe(true)
  })
})
