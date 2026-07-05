import { describe, expect, it } from 'vitest'
import { getProviderIcon, getProviderIconIds, hasProviderIcon } from '../provider-icons'
import { PROVIDER_ICON_IDS } from '../provider-icon-registry.generated'

const KNOWN_PROVIDER_IDS = [
  'openai',
  'gemini',
  'anthropic',
  'grok',
  'deepseek',
  'siliconflow',
  'kimi',
  'xiaomimimo',
  'minimax',
  'zhipu',
  'dashscope',
  'doubao',
  'volcengine',
  'lmstudio',
  'ollama',
  'openrouter',
  'opencodego',
  'mistral',
  'stepfun',
  'hunyuan',
  'vertexai',
  'vercel'
] as const

describe('provider-icons (LobeHub local assets)', () => {
  it('covers all built-in AI providers', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      expect(hasProviderIcon(id), `missing icon for ${id}`).toBe(true)
    }
    expect(PROVIDER_ICON_IDS.length).toBe(KNOWN_PROVIDER_IDS.length)
  })

  it('returns bundled asset urls for light and dark', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      const light = getProviderIcon(id, false)
      const dark = getProviderIcon(id, true)
      expect(light, `${id} light`).toBeTruthy()
      expect(dark, `${id} dark`).toBeTruthy()
    }
    expect(getProviderIcon('opencodego', false)).toBe(getProviderIcon('opencodego', true))
  })

  it('getProviderIconIds matches registry', () => {
    expect(getProviderIconIds().sort()).toEqual([...PROVIDER_ICON_IDS].sort())
  })
})
