import { describe, expect, it } from 'vitest'
import { formatWorkspaceRollbackSummary } from '../workspace-rollback.util'

const t = (key: string, fallback: string, options?: Record<string, unknown>) => {
  if (options) {
    return fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''))
  }
  return fallback
}

describe('formatWorkspaceRollbackSummary', () => {
  it('summarizes restored and deleted paths', () => {
    const summary = formatWorkspaceRollbackSummary(
      {
        restored: ['src/a.ts', 'src/b.ts'],
        deleted: ['src/new.ts'],
        skipped: []
      },
      t
    )

    expect(summary.headline).toContain('2')
    expect(summary.headline).toContain('1')
    expect(summary.detailLines.join('\n')).toContain('src/a.ts')
    expect(summary.detailLines.join('\n')).toContain('src/new.ts')
  })

  it('reports skipped-only rollback', () => {
    const summary = formatWorkspaceRollbackSummary(
      {
        restored: [],
        deleted: [],
        skipped: ['missing.txt']
      },
      t
    )

    expect(summary.headline).toContain('1')
    expect(summary.detailLines.join('\n')).toContain('missing.txt')
  })
})
