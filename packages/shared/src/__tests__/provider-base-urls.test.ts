import { describe, expect, it } from 'vitest'
import { resolveProviderBaseUrl } from '../constants/provider-base-urls'

describe('resolveProviderBaseUrl', () => {
  it('returns explicit base URL when set', () => {
    expect(resolveProviderBaseUrl('siliconflow', 'siliconflow', 'https://custom.example/v1')).toBe(
      'https://custom.example/v1'
    )
  })

  it('falls back to provider default when base URL is blank', () => {
    expect(resolveProviderBaseUrl('siliconflow', 'siliconflow', '')).toBe(
      'https://api.siliconflow.cn/v1'
    )
    expect(resolveProviderBaseUrl('siliconflow', 'siliconflow', '   ')).toBe(
      'https://api.siliconflow.cn/v1'
    )
    expect(resolveProviderBaseUrl('opencodego', 'opencodego', '')).toBe(
      'https://opencode.ai/zen/go/v1'
    )
  })

  it('does not default to OpenAI for non-openai providers', () => {
    const resolved = resolveProviderBaseUrl('siliconflow', 'siliconflow', '')
    expect(resolved).not.toContain('api.openai.com')
    expect(resolved).toContain('siliconflow.cn')
  })

  it('normalizes root base URL to /v1 for ollama and lmstudio', () => {
    expect(resolveProviderBaseUrl('ollama', 'ollama', 'http://127.0.0.1:11435')).toBe(
      'http://127.0.0.1:11435/v1'
    )
    expect(resolveProviderBaseUrl('ollama', 'ollama', 'http://127.0.0.1:11435/')).toBe(
      'http://127.0.0.1:11435/v1'
    )
    expect(resolveProviderBaseUrl('ollama', 'ollama', 'http://localhost:11434')).toBe(
      'http://localhost:11434/v1'
    )
    expect(resolveProviderBaseUrl('ollama', 'ollama', 'http://127.0.0.1:11435/v1')).toBe(
      'http://127.0.0.1:11435/v1'
    )
    expect(resolveProviderBaseUrl('lmstudio', 'lmstudio', 'http://localhost:1234')).toBe(
      'http://localhost:1234/v1'
    )
    // 其他非本地兼容服务保持原样
    expect(resolveProviderBaseUrl('deepseek', 'deepseek', 'https://api.deepseek.com')).toBe(
      'https://api.deepseek.com'
    )
  })
})
