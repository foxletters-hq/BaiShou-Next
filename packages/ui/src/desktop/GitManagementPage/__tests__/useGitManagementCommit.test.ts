import { act, renderHook } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { useGitManagementCommit } from '../useGitManagementCommit'

const t = ((key: string, fallback?: string) =>
  typeof fallback === 'string' ? fallback : key) as TFunction

function createParams(overrides: Record<string, unknown> = {}) {
  return {
    t,
    commitMessage: 'msg',
    setCommitMessage: vi.fn(),
    onCommit: vi.fn().mockResolvedValue({ hash: 'abc1234', files: ['a.md'] }),
    onCommitAll: vi.fn().mockResolvedValue({ hash: 'def5678', files: ['a.md', 'b.md'] }),
    stagedCount: 1,
    onPush: vi.fn().mockResolvedValue({ success: true }),
    onToast: vi.fn(),
    isRemoteConfigured: () => true,
    notifyRemoteRequired: vi.fn(),
    handleRefreshStatus: vi.fn().mockResolvedValue(undefined),
    handleLoadHistory: vi.fn().mockResolvedValue(undefined),
    setSelectedCommit: vi.fn(),
    setCommitChanges: vi.fn(),
    setSelectedFileDiff: vi.fn(),
    ...overrides
  }
}

describe('useGitManagementCommit', () => {
  it('smart commit uses staged-only when the index is not empty', async () => {
    const params = createParams({ stagedCount: 1 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleManualCommit()
    })

    expect(params.onCommit).toHaveBeenCalledWith('msg')
    expect(params.onCommitAll).not.toHaveBeenCalled()
    expect(params.onPush).not.toHaveBeenCalled()
  })

  it('smart commit stages remaining files when the index is empty', async () => {
    const params = createParams({ stagedCount: 0 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleManualCommit()
    })

    expect(params.onCommitAll).toHaveBeenCalledWith('msg')
    expect(params.onCommit).not.toHaveBeenCalled()
  })

  it('commit staged never stages remaining workspace files', async () => {
    const params = createParams({ stagedCount: 2 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitStaged()
    })

    expect(params.onCommit).toHaveBeenCalledWith('msg')
    expect(params.onCommitAll).not.toHaveBeenCalled()
    expect(params.onPush).not.toHaveBeenCalled()
    expect(params.onToast).toHaveBeenCalledWith('已提交 {{count}} 个暂存文件', 'success')
    expect(params.onToast).not.toHaveBeenCalledWith('已暂存并提交 {{count}} 个文件', 'success')
  })

  it('commit all stages remaining files even when the index is not empty', async () => {
    const params = createParams({ stagedCount: 2 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAll()
    })

    expect(params.onCommitAll).toHaveBeenCalledWith('msg')
    expect(params.onCommit).not.toHaveBeenCalled()
    expect(params.onPush).not.toHaveBeenCalled()
    expect(params.onToast).toHaveBeenCalledWith('已暂存并提交 {{count}} 个文件', 'success')
  })

  it('smart commit then push uses staged-only commit when files are staged', async () => {
    const params = createParams({ stagedCount: 1 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAndPush()
    })

    expect(params.onCommit).toHaveBeenCalledWith('msg')
    expect(params.onCommitAll).not.toHaveBeenCalled()
    expect(params.onPush).toHaveBeenCalledTimes(1)
    expect(params.handleRefreshStatus).toHaveBeenCalledWith({ fetch: true })
  })

  it('commit all then push uses onCommitAll and refreshes after push', async () => {
    const params = createParams({ stagedCount: 1 })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAllAndPush()
    })

    expect(params.onCommitAll).toHaveBeenCalledWith('msg')
    expect(params.onCommit).not.toHaveBeenCalled()
    expect(params.onPush).toHaveBeenCalledTimes(1)
    expect(params.handleRefreshStatus).toHaveBeenCalledWith({ fetch: true })
  })

  it('does not push when smart commit returns no commit', async () => {
    const params = createParams({
      stagedCount: 1,
      onCommit: vi.fn().mockResolvedValue(null)
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAndPush()
    })

    expect(params.onPush).not.toHaveBeenCalled()
    expect(params.notifyRemoteRequired).not.toHaveBeenCalled()
  })

  it('does not push when commit all returns no commit', async () => {
    const params = createParams({
      onCommitAll: vi.fn().mockResolvedValue(null)
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAllAndPush()
    })

    expect(params.onPush).not.toHaveBeenCalled()
  })

  it('does not push when commit throws', async () => {
    const params = createParams({
      onCommitAll: vi.fn().mockRejectedValue(new Error('No changes'))
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAllAndPush()
    })

    expect(params.onPush).not.toHaveBeenCalled()
  })

  it('skips push and shows the remote warning after a successful commit', async () => {
    const params = createParams({
      isRemoteConfigured: () => false
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAllAndPush()
    })

    expect(params.onCommitAll).toHaveBeenCalled()
    expect(params.onPush).not.toHaveBeenCalled()
    expect(params.notifyRemoteRequired).toHaveBeenCalledTimes(1)
    expect(params.handleRefreshStatus).not.toHaveBeenCalledWith({ fetch: true })
  })

  it('reports push failure instead of commit failure when onPush throws', async () => {
    const params = createParams({
      onPush: vi.fn().mockRejectedValue(new Error('network down'))
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    await act(async () => {
      await result.current.handleCommitAndPush()
    })

    expect(params.onToast).toHaveBeenCalledWith('network down', 'error')
    expect(params.onToast).not.toHaveBeenCalledWith('提交失败', 'error')
  })

  it('ignores a second commit action while one is in flight', async () => {
    let release!: (value: { hash: string; files: string[] }) => void
    const params = createParams({
      onCommit: vi.fn(
        () =>
          new Promise((resolve) => {
            release = resolve
          })
      )
    })
    const { result } = renderHook(() => useGitManagementCommit(params as never))

    let first: Promise<void>
    act(() => {
      first = result.current.handleManualCommit()
    })

    expect(result.current.isCommitActionInFlight).toBe(true)

    await act(async () => {
      await result.current.handleCommitAll()
    })
    expect(params.onCommitAll).not.toHaveBeenCalled()

    await act(async () => {
      release({ hash: 'abc1234', files: ['a.md'] })
      await first
    })

    expect(params.onCommit).toHaveBeenCalledTimes(1)
    expect(result.current.isCommitActionInFlight).toBe(false)
  })
})
