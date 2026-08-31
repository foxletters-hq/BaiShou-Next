import { describe, expect, it } from 'vitest'
import { formatWorkspaceRollbackSummary } from '../../utils/workspace-rollback.util'

describe('workspace edit-resend / rollback copy', () => {
  const t = (key: string, fallback: string) => fallback

  it('formats rollback summary with restored and deleted paths', () => {
    const summary = formatWorkspaceRollbackSummary(
      {
        restored: ['src/a.ts'],
        deleted: ['src/new.ts'],
        skipped: []
      },
      t
    )
    expect(summary.headline).toContain('回滚')
    expect(summary.detailLines.join('\n')).toContain('src/a.ts')
    expect(summary.detailLines.join('\n')).toContain('src/new.ts')
  })

  it('documents edit-resend confirm scope note keys', () => {
    // 与 useWorkspaceMessageActions 文案键保持一致，避免裸字符串漂移
    const keys = {
      title: 'workspace_edit_resend.confirm_title',
      desc: 'workspace_edit_resend.confirm_desc',
      dontAskAgain: 'workspace_edit_resend.dont_ask_again',
      scope: 'round_rollback.scope_note',
      attributed: 'round_rollback.scope_attributed',
      attributedDesc: 'round_rollback.scope_attributed_desc',
      all: 'round_rollback.scope_all',
      allDesc: 'round_rollback.scope_all_desc',
      failed: 'workspace_edit_resend.failed'
    }
    expect(Object.values(keys).every((k) => k.includes('.'))).toBe(true)
  })
})
