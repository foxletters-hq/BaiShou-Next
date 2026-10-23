import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { useGitManagementWorkspace } from '../useGitManagementWorkspace'

const t = ((key: string, fallback?: string) =>
  typeof fallback === 'string' ? fallback : key) as TFunction

function createParams(overrides: Record<string, unknown> = {}) {
  return {
    t,
    onToast: vi.fn(),
    onGetCommitChanges: vi.fn().mockResolvedValue([]),
    onGetFileDiff: vi.fn(),
    onGetWorkingDiff: vi.fn(),
    onStageFile: vi.fn(),
    onStageAll: vi.fn(),
    onUnstageFile: vi.fn(),
    onUnstageAll: vi.fn(),
    onDiscardFile: vi.fn(),
    onDiscardAllChanges: vi.fn(),
    onRollbackFile: vi.fn(),
    onRollbackAll: vi.fn(),
    onGetRollbackAllContext: vi.fn(),
    expandedCommit: 'abc1234',
    setExpandedCommit: vi.fn(),
    setSelectedCommit: vi.fn(),
    setCommitChanges: vi.fn(),
    setSelectedFileDiff: vi.fn(),
    selectedCommit: 'abc1234',
    expandedFile: null,
    setExpandedFile: vi.fn(),
    expandedWorkingFile: null,
    setExpandedWorkingFile: vi.fn(),
    setWorkingFileDiff: vi.fn(),
    handleRefreshStatus: vi.fn(),
    handleLoadHistory: vi.fn(),
    onOpenDiffInEditor: vi.fn(),
    onOpenCommitDiffInEditor: vi.fn(),
    ...overrides
  }
}

describe('useGitManagementWorkspace history file open', () => {
  it('should open the selected commit file in the editor when a history file is clicked', async () => {
    const params = createParams()
    const { result } = renderHook(() => useGitManagementWorkspace(params as never))

    await act(async () => {
      await result.current.handleViewDiff('notes/brief.md')
    })

    expect(params.onOpenCommitDiffInEditor).toHaveBeenCalledWith('notes/brief.md', 'abc1234')
    expect(params.onGetFileDiff).not.toHaveBeenCalled()
  })
})

describe('useGitManagementPage editor callbacks', () => {
  it('should forward history and working-tree open callbacks into the workspace hook', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'useGitManagementPage.ts'),
      'utf8'
    )
    const workspaceCall = source.slice(source.indexOf('useGitManagementWorkspace({'))
    expect(workspaceCall).toContain('onOpenCommitDiffInEditor')
    expect(workspaceCall).toContain('onOpenDiffInEditor')
  })
})
