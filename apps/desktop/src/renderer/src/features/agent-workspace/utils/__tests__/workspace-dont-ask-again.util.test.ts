import { afterEach, describe, expect, it } from 'vitest'
import { SKIP_EDIT_RESEND_CONFIRM_KEY } from '../workspace-edit-resend-skip.util'
import {
  clearAllWorkbenchDontAskAgain,
  hasAnyWorkbenchDontAskAgain,
  readSkipMoveConfirm,
  readSkipRemoveRecentConfirm,
  SKIP_MOVE_CONFIRM_KEY,
  SKIP_REMOVE_RECENT_CONFIRM_KEY,
  writeSkipMoveConfirm,
  writeSkipRemoveRecentConfirm
} from '../workspace-dont-ask-again.util'

describe('workspace dont-ask-again', () => {
  afterEach(() => {
    localStorage.removeItem(SKIP_EDIT_RESEND_CONFIRM_KEY)
    localStorage.removeItem(SKIP_MOVE_CONFIRM_KEY)
    localStorage.removeItem(SKIP_REMOVE_RECENT_CONFIRM_KEY)
  })

  it('starts with no skipped prompts', () => {
    expect(hasAnyWorkbenchDontAskAgain()).toBe(false)
    expect(readSkipMoveConfirm()).toBe(false)
    expect(readSkipRemoveRecentConfirm()).toBe(false)
  })

  it('clears every workbench skip key', () => {
    writeSkipMoveConfirm()
    writeSkipRemoveRecentConfirm()
    localStorage.setItem(SKIP_EDIT_RESEND_CONFIRM_KEY, 'all')
    expect(hasAnyWorkbenchDontAskAgain()).toBe(true)

    expect(clearAllWorkbenchDontAskAgain()).toBe(3)
    expect(hasAnyWorkbenchDontAskAgain()).toBe(false)
    expect(readSkipMoveConfirm()).toBe(false)
    expect(readSkipRemoveRecentConfirm()).toBe(false)
    expect(localStorage.getItem(SKIP_EDIT_RESEND_CONFIRM_KEY)).toBeNull()
  })

  it('returns 0 when nothing was skipped', () => {
    expect(clearAllWorkbenchDontAskAgain()).toBe(0)
  })
})
