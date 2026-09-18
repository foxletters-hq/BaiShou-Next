import { describe, expect, it } from 'vitest'
import {
  CHROMIUM_ERR_ABORTED,
  isHelpDocsMainFrameFailure,
  isHelpDocsSuccessfulDocumentUrl,
  isHelpDocsWebviewHost,
  readHelpDocsWebviewUrl
} from '../help-docs-webview.util'

describe('isHelpDocsMainFrameFailure', () => {
  it('ignores subframe and events without isMainFrame', () => {
    expect(isHelpDocsMainFrameFailure({ isMainFrame: false, errorCode: -105 })).toBe(false)
    expect(isHelpDocsMainFrameFailure({ errorCode: -105 })).toBe(false)
  })

  it('ignores aborted navigations that still let the page open', () => {
    expect(
      isHelpDocsMainFrameFailure({ isMainFrame: true, errorCode: CHROMIUM_ERR_ABORTED })
    ).toBe(false)
    expect(isHelpDocsMainFrameFailure({ isMainFrame: true, errorCode: '-3' })).toBe(false)
  })

  it('treats real main-frame network errors as failure', () => {
    expect(isHelpDocsMainFrameFailure({ isMainFrame: true, errorCode: -105 })).toBe(true)
    expect(isHelpDocsMainFrameFailure({ isMainFrame: true, errorCode: -106 })).toBe(true)
  })

  it('ignores missing or non-negative error codes', () => {
    expect(isHelpDocsMainFrameFailure({ isMainFrame: true })).toBe(false)
    expect(isHelpDocsMainFrameFailure({ isMainFrame: true, errorCode: 0 })).toBe(false)
  })
})

describe('isHelpDocsSuccessfulDocumentUrl', () => {
  it('accepts http(s) documents and rejects chrome error pages', () => {
    expect(isHelpDocsSuccessfulDocumentUrl('https://foxletters.com/docs/')).toBe(true)
    expect(isHelpDocsSuccessfulDocumentUrl('http://127.0.0.1:4173/docs/')).toBe(true)
    expect(isHelpDocsSuccessfulDocumentUrl('chrome-error://chromewebdata/')).toBe(false)
    expect(isHelpDocsSuccessfulDocumentUrl('')).toBe(false)
    expect(isHelpDocsSuccessfulDocumentUrl(undefined)).toBe(false)
  })
})

describe('isHelpDocsWebviewHost', () => {
  it('should accept an object with getURL and reject values without that function', () => {
    expect(isHelpDocsWebviewHost({ getURL: () => 'https://foxletters.com/docs/' })).toBe(true)
    expect(isHelpDocsWebviewHost({})).toBe(false)
    expect(isHelpDocsWebviewHost({ getURL: 'https://foxletters.com/docs/' })).toBe(false)
    expect(isHelpDocsWebviewHost(null)).toBe(false)
    expect(isHelpDocsWebviewHost(document.createElement('div'))).toBe(false)
  })
})

describe('readHelpDocsWebviewUrl', () => {
  it('reads getURL when the guest document is ready', () => {
    expect(readHelpDocsWebviewUrl({ getURL: () => 'https://foxletters.com/docs/' })).toBe(
      'https://foxletters.com/docs/'
    )
    expect(readHelpDocsWebviewUrl({})).toBe('')
  })
})
