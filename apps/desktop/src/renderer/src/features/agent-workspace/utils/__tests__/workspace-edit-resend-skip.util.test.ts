import { afterEach, describe, expect, it } from 'vitest'
import {
  readSkipEditResendConfirm,
  SKIP_EDIT_RESEND_CONFIRM_KEY,
  writeSkipEditResendConfirm
} from '../workspace-edit-resend-skip.util'

describe('workspace edit-resend skip confirm', () => {
  afterEach(() => {
    localStorage.removeItem(SKIP_EDIT_RESEND_CONFIRM_KEY)
  })

  it('returns null when the user has not opted out', () => {
    expect(readSkipEditResendConfirm()).toBeNull()
  })

  it('remembers the last chosen rollback scope', () => {
    writeSkipEditResendConfirm('all')
    expect(readSkipEditResendConfirm()).toBe('all')
    writeSkipEditResendConfirm('attributed')
    expect(readSkipEditResendConfirm()).toBe('attributed')
  })

  it('treats legacy 1 as attributed', () => {
    localStorage.setItem(SKIP_EDIT_RESEND_CONFIRM_KEY, '1')
    expect(readSkipEditResendConfirm()).toBe('attributed')
  })
})
