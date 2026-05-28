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
  })

  it('does not default to OpenAI for non-openai providers', () => {
    const resolved = resolveProviderBaseUrl('siliconflow', 'siliconflow', '')
    expect(resolved).not.toContain('api.openai.com')
    expect(resolved).toContain('siliconflow.cn')
  })
})
