import { describe, expect, it, vi } from 'vitest'
import {
  decideHelpDocsNavigation,
  decideHelpDocsWindowOpen,
  installHelpDocsWebviewNavigation,
  isHelpDocsInAppUrl
} from '../help-docs-webview-navigation.util'

describe('isHelpDocsInAppUrl', () => {
  it('keeps the official docs host inside the tutorial webview', () => {
    expect(isHelpDocsInAppUrl('https://foxletters.com/docs/getting-started/quick-start/')).toBe(
      true
    )
    expect(isHelpDocsInAppUrl('https://www.foxletters.com/docs/')).toBe(true)
    expect(isHelpDocsInAppUrl('https://foxletters.com')).toBe(true)
  })

  it('treats other sites as leaving the tutorial page', () => {
    expect(isHelpDocsInAppUrl('https://github.com/foxletters-hq/BaiShou-Next')).toBe(false)
    expect(isHelpDocsInAppUrl('https://baishou.foxletters.com/')).toBe(false)
    expect(isHelpDocsInAppUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('decideHelpDocsWindowOpen', () => {
  it('never creates an Electron window and opens http(s) in the system browser', () => {
    expect(decideHelpDocsWindowOpen('https://github.com/foxletters-hq')).toEqual({
      action: 'deny',
      openExternalUrl: 'https://github.com/foxletters-hq'
    })
    expect(decideHelpDocsWindowOpen('https://foxletters.com/docs/')).toEqual({
      action: 'deny',
      openExternalUrl: 'https://foxletters.com/docs/'
    })
    expect(decideHelpDocsWindowOpen('javascript:alert(1)')).toEqual({ action: 'deny' })
  })
})

describe('decideHelpDocsNavigation', () => {
  it('keeps in-app docs navigation and sends other http(s) links to the browser', () => {
    expect(decideHelpDocsNavigation('https://foxletters.com/docs/')).toBe('allow')
    expect(decideHelpDocsNavigation('about:blank')).toBe('allow')
    expect(decideHelpDocsNavigation('https://space.bilibili.com/1')).toEqual({
      openExternalUrl: 'https://space.bilibili.com/1'
    })
    expect(decideHelpDocsNavigation('file:///tmp/x')).toBe('block')
  })
})

describe('installHelpDocsWebviewNavigation', () => {
  function createContents(type: string) {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
    return {
      getType: () => type,
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const list = listeners.get(event) ?? []
        list.push(listener)
        listeners.set(event, list)
      }),
      emit(event: string, ...args: unknown[]) {
        for (const listener of listeners.get(event) ?? []) listener(...args)
      }
    }
  }

  it('ignores the main window contents', () => {
    const contents = createContents('window')
    const openExternal = vi.fn()
    expect(installHelpDocsWebviewNavigation(contents, openExternal)).toBe(false)
    expect(contents.setWindowOpenHandler).not.toHaveBeenCalled()
  })

  it('opens new-window and off-site navigations in the system browser', () => {
    const contents = createContents('webview')
    const openExternal = vi.fn()
    expect(installHelpDocsWebviewNavigation(contents, openExternal)).toBe(true)

    const handler = contents.setWindowOpenHandler.mock.calls[0][0] as (details: {
      url: string
    }) => { action: 'deny' }
    expect(handler({ url: 'https://github.com/foxletters-hq' })).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledWith('https://github.com/foxletters-hq')

    const preventDefault = vi.fn()
    contents.emit('will-navigate', { preventDefault }, 'https://space.bilibili.com/1')
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://space.bilibili.com/1')

    preventDefault.mockClear()
    contents.emit('will-navigate', { preventDefault }, 'https://foxletters.com/docs/')
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('does not intercept subframe redirects', () => {
    const contents = createContents('webview')
    const openExternal = vi.fn()
    installHelpDocsWebviewNavigation(contents, openExternal)
    const preventDefault = vi.fn()
    contents.emit(
      'will-redirect',
      { preventDefault },
      'https://github.com/foxletters-hq',
      false,
      false
    )
    expect(preventDefault).not.toHaveBeenCalled()
    expect(openExternal).not.toHaveBeenCalled()
  })
})
