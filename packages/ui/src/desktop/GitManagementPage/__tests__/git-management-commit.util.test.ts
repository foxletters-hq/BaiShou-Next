import { describe, expect, it, vi } from 'vitest'
import {
  executeGitCommit,
  resolveCommitSuccessToast,
  resolveGitCommitApi,
  shouldPushAfterCommit
} from '../git-management-commit.util'

describe('resolveGitCommitApi', () => {
  it('smart uses staged when staged files exist', () => {
    expect(resolveGitCommitApi('smart', 2)).toBe('staged')
  })

  it('smart uses all when nothing is staged', () => {
    expect(resolveGitCommitApi('smart', 0)).toBe('all')
  })

  it('staged always uses staged even when the index is empty', () => {
    expect(resolveGitCommitApi('staged', 0)).toBe('staged')
    expect(resolveGitCommitApi('staged', 3)).toBe('staged')
  })

  it('all always uses all even when files are already staged', () => {
    expect(resolveGitCommitApi('all', 0)).toBe('all')
    expect(resolveGitCommitApi('all', 3)).toBe('all')
  })
})

describe('shouldPushAfterCommit', () => {
  it('only allows push after a successful commit', () => {
    expect(shouldPushAfterCommit(true)).toBe(true)
    expect(shouldPushAfterCommit(false)).toBe(false)
  })
})

describe('resolveCommitSuccessToast', () => {
  it('uses staged copy for staged-only local commit', () => {
    expect(
      resolveCommitSuccessToast({
        fileCount: 2,
        mode: 'local',
        scope: 'staged',
        stagedCount: 2
      }).fallback
    ).toBe('已提交 {{count}} 个暂存文件')
  })

  it('uses stage-all copy for commit all', () => {
    expect(
      resolveCommitSuccessToast({
        fileCount: 2,
        mode: 'local',
        scope: 'all',
        stagedCount: 2
      }).fallback
    ).toBe('已暂存并提交 {{count}} 个文件')
  })

  it('smart commit with staged files uses staged copy', () => {
    expect(
      resolveCommitSuccessToast({
        fileCount: 1,
        mode: 'push',
        scope: 'smart',
        stagedCount: 1
      }).fallback
    ).toBe('已提交 {{count}} 个暂存文件，正在推送...')
  })
})

describe('executeGitCommit', () => {
  it('smart with staged files calls onCommit only', async () => {
    const onCommit = vi.fn().mockResolvedValue({ hash: 'abc1234', files: ['a.md'] })
    const onCommitAll = vi.fn()

    await expect(
      executeGitCommit({
        scope: 'smart',
        stagedCount: 1,
        message: 'fix typo',
        onCommit,
        onCommitAll
      })
    ).resolves.toEqual({ ok: true, fileCount: 1 })

    expect(onCommit).toHaveBeenCalledWith('fix typo')
    expect(onCommitAll).not.toHaveBeenCalled()
  })

  it('smart without staged files calls onCommitAll only', async () => {
    const onCommit = vi.fn()
    const onCommitAll = vi.fn().mockResolvedValue({ hash: 'abc1234', files: ['a.md', 'b.md'] })

    await expect(
      executeGitCommit({
        scope: 'smart',
        stagedCount: 0,
        message: 'save all',
        onCommit,
        onCommitAll
      })
    ).resolves.toEqual({ ok: true, fileCount: 2 })

    expect(onCommit).not.toHaveBeenCalled()
    expect(onCommitAll).toHaveBeenCalledWith('save all')
  })

  it('staged never calls onCommitAll', async () => {
    const onCommit = vi.fn().mockResolvedValue({ hash: 'abc1234', files: ['a.md'] })
    const onCommitAll = vi.fn()

    await executeGitCommit({
      scope: 'staged',
      stagedCount: 2,
      message: 'staged only',
      onCommit,
      onCommitAll
    })

    expect(onCommit).toHaveBeenCalledWith('staged only')
    expect(onCommitAll).not.toHaveBeenCalled()
  })

  it('all never calls onCommit even when staged files exist', async () => {
    const onCommit = vi.fn()
    const onCommitAll = vi.fn().mockResolvedValue({ hash: 'abc1234', files: ['a.md', 'b.md'] })

    await executeGitCommit({
      scope: 'all',
      stagedCount: 2,
      message: 'commit everything',
      onCommit,
      onCommitAll
    })

    expect(onCommit).not.toHaveBeenCalled()
    expect(onCommitAll).toHaveBeenCalledWith('commit everything')
  })

  it('treats a null commit result as failure so callers must skip push', async () => {
    const onCommit = vi.fn().mockResolvedValue(null)
    const outcome = await executeGitCommit({
      scope: 'staged',
      stagedCount: 0,
      message: 'nothing staged',
      onCommit,
      onCommitAll: vi.fn()
    })

    expect(outcome).toEqual({ ok: false, fileCount: 0 })
    expect(shouldPushAfterCommit(outcome.ok)).toBe(false)
  })

  it('fills an empty message before calling the commit API', async () => {
    const onCommit = vi.fn().mockResolvedValue({ hash: 'abc1234', files: [] })
    const fixed = new Date('2026-09-01T03:58:00')
    vi.useFakeTimers()
    vi.setSystemTime(fixed)

    try {
      await executeGitCommit({
        scope: 'staged',
        stagedCount: 1,
        message: '   ',
        onCommit,
        onCommitAll: vi.fn()
      })
    } finally {
      vi.useRealTimers()
    }

    expect(onCommit).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/))
  })
})
