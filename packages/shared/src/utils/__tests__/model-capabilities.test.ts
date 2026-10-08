import { beforeEach, describe, expect, it } from 'vitest'
import { isVisionModel } from '../model-capabilities'
import { isProviderListedVisionModel } from '../provider-vision-models'
import { isVisionModelInSnapshot, VISION_MODELS_SNAPSHOT } from '../vision-models.snapshot'
import { resetVisionModelsRuntimeOverlayForTests } from '../vision-models.runtime'

beforeEach(() => {
  resetVisionModelsRuntimeOverlayForTests()
})

describe('VISION_MODELS_SNAPSHOT', () => {
  it('includes opencodego kimi vision models from models.dev', () => {
    const opencode = VISION_MODELS_SNAPSHOT.byProvider.opencodego
    expect(opencode).toContain('kimi-k2.7-code')
    expect(opencode).toContain('kimi-k2.6')
  })

  it('includes current Claude Haiku and GPT Luna vision ids', () => {
    expect(VISION_MODELS_SNAPSHOT.byProvider.anthropic).toContain('claude-haiku-5-5')
    expect(VISION_MODELS_SNAPSHOT.byProvider.openai).toContain('gpt-5.6-luna')
    expect(VISION_MODELS_SNAPSHOT.byProvider.openai).toContain('gpt-6-luna')
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

  it('treats current Claude and GPT vision families as vision', () => {
    expect(isVisionModel('claude-haiku-5-5', 'anthropic')).toBe(true)
    expect(isVisionModel('claude-haiku-5.5', 'openrouter')).toBe(true)
    expect(isVisionModel('claude-sonnet-5-5', 'anthropic')).toBe(true)
    expect(isVisionModel('claude-opus-5', 'anthropic')).toBe(true)
    expect(isVisionModel('claude-fable-5-1', 'anthropic')).toBe(true)
    expect(isVisionModel('gpt-5.6-luna', 'openai')).toBe(true)
    expect(isVisionModel('gpt-6-luna', 'openai')).toBe(true)
    expect(isVisionModel('gpt-6-sol', 'openai')).toBe(true)
  })

  it('treats all kimi series as vision by default', () => {
    expect(isVisionModel('kimi-k3', 'kimi')).toBe(true)
    expect(isVisionModel('kimi-k3.0', 'kimi')).toBe(true)
    expect(isVisionModel('moonshotai/Kimi-K3', 'siliconflow')).toBe(true)
    expect(isVisionModel('kimi-latest', 'kimi')).toBe(true)
    expect(isVisionModel('kimi-thinking-preview', 'kimi')).toBe(true)
    expect(isVisionModel('k3p1', 'kimi')).toBe(true)
    expect(isVisionModel('k2p5', 'kimi')).toBe(true)
  })

  it('treats DeepSeek Flash and later native-vision models as vision', () => {
    expect(isVisionModel('deepseek-flash', 'deepseek')).toBe(true)
    expect(isVisionModel('deepseek-v4-flash', 'deepseek')).toBe(true)
    expect(isVisionModel('deepseek-v4-flash-vision-exp', 'deepseek')).toBe(true)
    expect(isVisionModel('deepseek-ai/DeepSeek-V4.1-Flash', 'siliconflow')).toBe(true)
    expect(isVisionModel('deepseek-vl', 'deepseek')).toBe(true)
  })

  it('keeps known DeepSeek text-only models as non-vision', () => {
    expect(isVisionModel('deepseek-chat', 'deepseek')).toBe(false)
    expect(isVisionModel('deepseek-reasoner', 'deepseek')).toBe(false)
    expect(isVisionModel('deepseek-v4-pro', 'deepseek')).toBe(false)
    expect(isVisionModel('deepseek-ai/DeepSeek-V3', 'siliconflow')).toBe(false)
  })
})
