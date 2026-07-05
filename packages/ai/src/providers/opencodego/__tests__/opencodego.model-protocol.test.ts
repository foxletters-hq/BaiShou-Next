import { describe, expect, it } from 'vitest'
import {
  resolveEffectiveProviderType,
  resolveOpenCodeGoWireProtocol
} from '../opencodego.model-protocol'

describe('resolveOpenCodeGoWireProtocol', () => {
  it('routes documented OpenAI wire models', () => {
    expect(resolveOpenCodeGoWireProtocol('kimi-k2.7-code')).toBe('openai')
    expect(resolveOpenCodeGoWireProtocol('glm-5.2')).toBe('openai')
    expect(resolveOpenCodeGoWireProtocol('deepseek-v4-flash')).toBe('openai')
  })

  it('routes documented Anthropic wire models', () => {
    expect(resolveOpenCodeGoWireProtocol('minimax-m3')).toBe('anthropic')
    expect(resolveOpenCodeGoWireProtocol('qwen3.7-max')).toBe('anthropic')
    expect(resolveOpenCodeGoWireProtocol('qwen3.6-plus')).toBe('anthropic')
  })

  it('uses naming heuristic for undocumented models', () => {
    expect(resolveOpenCodeGoWireProtocol('qwen3.5-plus')).toBe('anthropic')
    expect(resolveOpenCodeGoWireProtocol('mimo-v2.5')).toBe('openai')
  })
})

describe('resolveEffectiveProviderType', () => {
  it('passes through non-opencodego providers', () => {
    expect(resolveEffectiveProviderType('openai', 'gpt-4o')).toBe('openai')
    expect(resolveEffectiveProviderType('anthropic', 'claude-3')).toBe('anthropic')
  })

  it('resolves opencodego to wire protocol per model', () => {
    expect(resolveEffectiveProviderType('opencodego', 'kimi-k2.7-code')).toBe('openai')
    expect(resolveEffectiveProviderType('opencodego', 'minimax-m2.7')).toBe('anthropic')
  })

  it('keeps opencodego when model id is missing', () => {
    expect(resolveEffectiveProviderType('opencodego')).toBe('opencodego')
    expect(resolveEffectiveProviderType('opencodego', '   ')).toBe('opencodego')
  })
})
