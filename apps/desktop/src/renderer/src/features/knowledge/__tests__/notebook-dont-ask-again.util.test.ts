import { afterEach, describe, expect, it } from 'vitest'
import {
  clearAllNotebookDontAskAgain,
  dismissNotebookOpenGuide,
  hasAnyNotebookDontAskAgain,
  notebookSessionDismissOpenGuideKey,
  notebookSkipOpenGuideKey,
  readSkipNotebookOpenGuide,
  shouldShowNotebookOpenGuide,
  writeSkipNotebookOpenGuide
} from '../notebook-dont-ask-again.util'

describe('notebook dont-ask-again', () => {
  afterEach(() => {
    localStorage.removeItem(notebookSkipOpenGuideKey('nb-a'))
    localStorage.removeItem(notebookSkipOpenGuideKey('nb-b'))
    sessionStorage.removeItem(notebookSessionDismissOpenGuideKey('nb-a'))
    sessionStorage.removeItem(notebookSessionDismissOpenGuideKey('nb-b'))
  })

  it('starts with no skipped prompts', () => {
    expect(hasAnyNotebookDontAskAgain()).toBe(false)
    expect(readSkipNotebookOpenGuide('nb-a')).toBe(false)
  })

  it('skips only the chosen notebook and can restore all', () => {
    writeSkipNotebookOpenGuide('nb-a')
    expect(readSkipNotebookOpenGuide('nb-a')).toBe(true)
    expect(readSkipNotebookOpenGuide('nb-b')).toBe(false)
    expect(hasAnyNotebookDontAskAgain()).toBe(true)
    expect(clearAllNotebookDontAskAgain()).toBe(1)
    expect(readSkipNotebookOpenGuide('nb-a')).toBe(false)
    expect(hasAnyNotebookDontAskAgain()).toBe(false)
  })

  it('returns 0 when nothing was skipped', () => {
    expect(clearAllNotebookDontAskAgain()).toBe(0)
  })

  it('keeps the guide closed after 知道了 even if the page remounts', () => {
    expect(shouldShowNotebookOpenGuide('nb-a')).toBe(true)
    dismissNotebookOpenGuide('nb-a', false)
    expect(shouldShowNotebookOpenGuide('nb-a')).toBe(false)
    expect(readSkipNotebookOpenGuide('nb-a')).toBe(false)
    expect(clearAllNotebookDontAskAgain()).toBe(1)
    expect(shouldShowNotebookOpenGuide('nb-a')).toBe(true)
  })
})
