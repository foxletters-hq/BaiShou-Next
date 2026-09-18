import { describe, expect, it } from 'vitest'
import { decideHelpDocsNavigation, isHelpDocsInAppUrl } from '../help-docs-navigation.util'

describe('decideHelpDocsNavigation', () => {
  it('should allow the official docs host', () => {
    expect(isHelpDocsInAppUrl('https://foxletters.com/docs/getting-started/quick-start/')).toBe(
      true
    )
    expect(
      decideHelpDocsNavigation('https://foxletters.com/docs/getting-started/quick-start/')
    ).toBe('allow')
  })

  it('should open other http urls outside the webview', () => {
    expect(decideHelpDocsNavigation('https://example.com/a')).toEqual({
      openExternalUrl: 'https://example.com/a'
    })
  })

  it('should block non-http schemes', () => {
    expect(decideHelpDocsNavigation('javascript:alert(1)')).toBe('block')
  })
})
