import { describe, expect, it } from 'vitest'
import type { WorkspaceRollbackPreview } from '@baishou/shared'
import {
  buildWorkspaceRollbackPreviewCopy,
  formatWorkspaceRollbackSummary
} from '../workspace-rollback.util'

const t = (_key: string, fallback: string, options?: Record<string, unknown>): string =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))

function createPreview(overrides: Partial<WorkspaceRollbackPreview> = {}): WorkspaceRollbackPreview {
  return {
    snapshotKind: 'git',
    rounds: 1,
    attributedPaths: [],
    extraPaths: [],
    changedPathsAvailable: true,
    ...overrides
  }
}

describe('workspace rollback preview copy', () => {
  it('lists the files the agent changed', () => {
    const copy = buildWorkspaceRollbackPreviewCopy(
      createPreview({ attributedPaths: ['notes/a.md', 'notes/b.md'] }),
      t
    )

    expect(copy.fileLines).toEqual(['将还原以下文件：', '  · notes/a.md', '  · notes/b.md'])
    expect(copy.needsScopeChoice).toBe(false)
    expect(copy.isEmpty).toBe(false)
  })

  it('asks the user to pick a scope when changes cannot be attributed to the agent', () => {
    const copy = buildWorkspaceRollbackPreviewCopy(
      createPreview({
        attributedPaths: ['notes/a.md'],
        extraPaths: ['build/output.log', 'notes/manual-edit.md']
      }),
      t
    )

    expect(copy.needsScopeChoice).toBe(true)
    expect(copy.extraLines[0]).toContain('另有 2 个文件')
    expect(copy.extraLines).toContain('  · build/output.log')
  })

  it('truncates long file lists instead of flooding the dialog', () => {
    const copy = buildWorkspaceRollbackPreviewCopy(
      createPreview({
        attributedPaths: Array.from({ length: 9 }, (_, i) => `file-${i}.md`)
      }),
      t
    )

    expect(copy.fileLines).toHaveLength(7)
    expect(copy.fileLines.at(-1)).toBe('  · 另有 4 个文件…')
  })

  it('warns that later rounds will be undone too', () => {
    const single = buildWorkspaceRollbackPreviewCopy(createPreview({ rounds: 1 }), t)
    const cascading = buildWorkspaceRollbackPreviewCopy(createPreview({ rounds: 3 }), t)

    expect(single.cascadeNote).toBeNull()
    expect(cascading.cascadeNote).toBe('将连同之后的 2 轮一起撤销。')
  })

  it('says so plainly when only the conversation will be removed', () => {
    const copy = buildWorkspaceRollbackPreviewCopy(createPreview(), t)

    expect(copy.isEmpty).toBe(true)
    expect(copy.fileLines).toEqual([])
    expect(copy.needsScopeChoice).toBe(false)
  })

  it('offers no scope choice when the snapshot cannot compute a full diff', () => {
    const copy = buildWorkspaceRollbackPreviewCopy(
      createPreview({
        snapshotKind: 'inline',
        changedPathsAvailable: false,
        attributedPaths: ['a.md']
      }),
      t
    )

    expect(copy.needsScopeChoice).toBe(false)
    expect(copy.extraLines).toEqual([])
  })
})

describe('workspace rollback summary', () => {
  it('reports restored and deleted counts in the headline', () => {
    const summary = formatWorkspaceRollbackSummary(
      { restored: ['a.md'], deleted: ['b.md', 'c.md'], skipped: [] },
      t
    )

    expect(summary.headline).toBe('已回滚本轮变更（1 恢复，2 删除）')
    expect(summary.detailLines).toContain('  · b.md')
  })
})
