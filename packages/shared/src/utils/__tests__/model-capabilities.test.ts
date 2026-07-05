import { describe, expect, it } from 'vitest'
import { isVisionModel } from '../model-capabilities'
import { isProviderListedVisionModel } from '../provider-vision-models'
import { isVisionModelInSnapshot, VISION_MODELS_SNAPSHOT } from '../vision-models.snapshot'

describe('VISION_MODELS_SNAPSHOT', () => {
  it('includes opencodego kimi vision models from models.dev', () => {
    const opencode = VISION_MODELS_SNAPSHOT.byProvider.opencodego
    expect(opencode).toContain('kimi-k2.7-code')
    expect(opencode).toContain('kimi-k2.6')
  })
})

describe('isVisionModelInSnapshot', () => {
  it('returns undefined for non-vision models (caller may regex-fallback)', () => {
    expect(isVisionModelInSnapshot('glm-5.2', 'opencodego')).toBeUndefined()
    expect(isVisionModelInSnapshot('deepseek-v4-pro', 'opencodego')).toBeUndefined()
  })

  it('returns true for snapshot-listed models', () => {
    expect(isVisionModelInSnapshot('kimi-k2.7-code', 'opencodego')).toBe(true)
    expect(isVisionModelInSnapshot('gpt-4o', 'openai')).toBe(true)
  })

  it('matches path-style model ids by normalized base name', () => {
    expect(isVisionModelInSnapshot('Qwen/Qwen3-VL-8B-Instruct', 'siliconflow')).toBe(true)
    expect(isVisionModelInSnapshot('moonshotai/Kimi-K2.5', 'siliconflow')).toBe(true)
  })
})

describe('isVisionModel', () => {
  it('uses models.dev snapshot for mapped providers', () => {
    expect(isVisionModel('kimi-k2.7-code', 'opencodego')).toBe(true)
    expect(isVisionModel('glm-5.2', 'opencodego')).toBe(false)
    expect(isVisionModel('gpt-4o', 'openai')).toBe(true)
  })

  it('shows vision for siliconflow path-style model ids', () => {
    expect(isVisionModel('Qwen/Qwen3-VL-8B-Instruct', 'siliconflow')).toBe(true)
    expect(isVisionModel('moonshotai/Kimi-K2.5', 'siliconflow')).toBe(true)
    expect(isVisionModel('deepseek-ai/DeepSeek-V3', 'siliconflow')).toBe(false)
  })

  it('falls back to manual overrides for local providers', () => {
    expect(isProviderListedVisionModel('ollama', 'llava:13b')).toBe(true)
    expect(isVisionModel('llava:13b', 'ollama')).toBe(true)
  })

  it('falls back to regex for unmapped providers', () => {
    expect(isVisionModel('qwen-vl-max', 'doubao')).toBe(true)
  })
})
