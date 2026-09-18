import { describe, expect, it } from 'vitest'
import { decideHelpDocsNavigation } from '@baishou/shared'

describe('mobile help docs navigation', () => {
  it('should keep official docs inside the webview', () => {
    expect(
      decideHelpDocsNavigation('https://foxletters.com/docs/getting-started/quick-start/')
    ).toBe('allow')
  })

  it('should keep javascript urls out of the webview', () => {
    expect(decideHelpDocsNavigation('javascript:alert(1)')).toBe('block')
  })
})
