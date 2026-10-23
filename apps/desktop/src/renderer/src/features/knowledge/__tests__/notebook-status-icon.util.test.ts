import { describe, expect, it, vi } from 'vitest'
import { resolveNotebookProviderIconSrc } from '../notebook-status-icon.util'

vi.mock('@baishou/ui', () => ({
  getProviderIcon: (id: string, isDark: boolean) => {
    if (id === 'missing') return undefined
    return `${id}:${isDark ? 'dark' : 'light'}`
  }
}))

describe('resolveNotebookProviderIconSrc', () => {
  it('should prefer the provider id over the provider type', () => {
    expect(
      resolveNotebookProviderIconSrc({
        providerId: 'deepseek',
        providerType: 'openai',
        isDark: false
      })
    ).toBe('deepseek:light')
  })

  it('should fall back to the provider type when the id has no icon', () => {
    expect(
      resolveNotebookProviderIconSrc({
        providerId: 'missing',
        providerType: 'openai',
        isDark: true
      })
    ).toBe('openai:dark')
  })
})
