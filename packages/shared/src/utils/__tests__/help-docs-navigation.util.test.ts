import { describe, expect, it } from 'vitest'
import { getHelpDocsLatteUrl } from '../../constants/github.constants'
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

describe('getHelpDocsLatteUrl', () => {
  it('should keep zh on the default latte docs path and prefix en/ja', () => {
    expect(getHelpDocsLatteUrl('zh')).toBe('https://foxletters.com/docs/basics/latte/')
    expect(getHelpDocsLatteUrl('en-US')).toBe('https://foxletters.com/en/docs/basics/latte/')
    expect(getHelpDocsLatteUrl('ja')).toBe('https://foxletters.com/ja/docs/basics/latte/')
  })
})
