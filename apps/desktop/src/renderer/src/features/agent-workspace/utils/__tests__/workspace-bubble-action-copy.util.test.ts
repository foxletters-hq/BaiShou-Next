import { describe, expect, it } from 'vitest'
import { workspaceBubbleActionCopy } from '../workspace-bubble-action-copy.util'

describe('workspaceBubbleActionCopy', () => {
  const t = (_key: string, fallback: string) => fallback

  it('should mention file rollback when the action is delete', () => {
    const copy = workspaceBubbleActionCopy('delete', t)
    expect(copy.title).toContain('撤回文件')
    expect(copy.intro).toContain('文件状态')
  })

  it('should use regenerate wording without claiming the user edited the text', () => {
    const copy = workspaceBubbleActionCopy('regenerate', t)
    expect(copy.title).toContain('重新生成')
    expect(copy.intro).not.toContain('改过的内容')
  })

  it('should keep edit-resend wording for edited user text', () => {
    const copy = workspaceBubbleActionCopy('edit_resend', t)
    expect(copy.title).toContain('编辑后')
    expect(copy.intro).toContain('改过的内容')
  })
})
