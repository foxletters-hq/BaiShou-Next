import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDesktopStorageExternalPaths } from '../useDesktopStorageExternalPaths'

describe('useDesktopStorageExternalPaths', () => {
  it('shows pre-pick explanation notice before opening journal directory picker and aborts if canceled', async () => {
    const confirmMock = vi.fn().mockResolvedValue(false)
    const pickMock = vi.fn().mockResolvedValue('/custom/journals')
    ;(window as any).api = {
      storage: {
        pickExternalJournalsDirectory: pickMock
      }
    }

    const t = vi.fn((key: string, fallback?: string) => {
      if (key === 'storage.external_journals_pick') return '自定义日记目录'
      if (key === 'storage.external_journals_pick_notice') {
        return '自定义日记目录用于将日记单独保存在设备上的指定文件夹中...'
      }
      return fallback ?? key
    }) as any

    const dialog = {
      confirm: confirmMock,
      alert: vi.fn(),
      prompt: vi.fn(),
      choose: vi.fn(),
      closeAll: vi.fn(),
      confirmWithDontAskAgain: vi.fn(),
      chooseWithDontAskAgain: vi.fn()
    } as any

    const toast = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showWarning: vi.fn(),
      showInfo: vi.fn()
    } as any

    const suppressRef = { current: false }
    const { result } = renderHook(() =>
      useDesktopStorageExternalPaths({
        t,
        dialog,
        toast,
        refreshStorageInfo: vi.fn().mockResolvedValue(undefined),
        setStorageBusy: vi.fn(),
        suppressExternalPathRefreshRef: suppressRef,
        setExternalJournalsPath: vi.fn(),
        setExternalJournalsPathAvailable: vi.fn(),
        setExternalJournalsFileCount: vi.fn(),
        setExternalSummariesPath: vi.fn(),
        setExternalSummariesPathAvailable: vi.fn(),
        setExternalSummariesFileCount: vi.fn(),
        setExternalSummariesFileCounts: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleChangeExternalJournalsDirectory()
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledWith(
      '自定义日记目录用于将日记单独保存在设备上的指定文件夹中...',
      '自定义日记目录'
    )
    expect(pickMock).not.toHaveBeenCalled()
  })

  it('proceeds to pick directory when user confirms notice', async () => {
    const confirmMock = vi
      .fn()
      .mockResolvedValueOnce(true) // 前置说明确认
      .mockResolvedValueOnce(false) // 选完目录后的应用取消

    const pickMock = vi.fn().mockResolvedValue('/custom/journals')
    ;(window as any).api = {
      storage: {
        pickExternalJournalsDirectory: pickMock
      }
    }

    const t = vi.fn((key: string, fallback?: string) => fallback ?? key) as any
    const dialog = { confirm: confirmMock } as any
    const toast = { showSuccess: vi.fn(), showError: vi.fn() } as any
    const suppressRef = { current: false }

    const { result } = renderHook(() =>
      useDesktopStorageExternalPaths({
        t,
        dialog,
        toast,
        refreshStorageInfo: vi.fn().mockResolvedValue(undefined),
        setStorageBusy: vi.fn(),
        suppressExternalPathRefreshRef: suppressRef,
        setExternalJournalsPath: vi.fn(),
        setExternalJournalsPathAvailable: vi.fn(),
        setExternalJournalsFileCount: vi.fn(),
        setExternalSummariesPath: vi.fn(),
        setExternalSummariesPathAvailable: vi.fn(),
        setExternalSummariesFileCount: vi.fn(),
        setExternalSummariesFileCounts: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleChangeExternalJournalsDirectory()
    })

    expect(confirmMock).toHaveBeenCalledTimes(2)
    expect(pickMock).toHaveBeenCalledTimes(1)
  })

  it('shows pre-pick explanation notice for summaries and aborts if canceled', async () => {
    const confirmMock = vi.fn().mockResolvedValue(false)
    const pickMock = vi.fn().mockResolvedValue('/custom/summaries')
    ;(window as any).api = {
      storage: {
        pickExternalSummariesDirectory: pickMock
      }
    }

    const t = vi.fn((key: string, fallback?: string) => {
      if (key === 'storage.external_summaries_pick') return '自定义总结目录'
      if (key === 'storage.external_summaries_pick_notice') {
        return '自定义总结目录用于将周记、月记、季报和年记保存在指定的外部文件夹中...'
      }
      return fallback ?? key
    }) as any

    const dialog = { confirm: confirmMock } as any
    const toast = { showSuccess: vi.fn(), showError: vi.fn() } as any
    const suppressRef = { current: false }

    const { result } = renderHook(() =>
      useDesktopStorageExternalPaths({
        t,
        dialog,
        toast,
        refreshStorageInfo: vi.fn().mockResolvedValue(undefined),
        setStorageBusy: vi.fn(),
        suppressExternalPathRefreshRef: suppressRef,
        setExternalJournalsPath: vi.fn(),
        setExternalJournalsPathAvailable: vi.fn(),
        setExternalJournalsFileCount: vi.fn(),
        setExternalSummariesPath: vi.fn(),
        setExternalSummariesPathAvailable: vi.fn(),
        setExternalSummariesFileCount: vi.fn(),
        setExternalSummariesFileCounts: vi.fn()
      })
    )

    await act(async () => {
      await result.current.handleChangeExternalSummariesDirectory()
    })

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledWith(
      '自定义总结目录用于将周记、月记、季报和年记保存在指定的外部文件夹中...',
      '自定义总结目录'
    )
    expect(pickMock).not.toHaveBeenCalled()
  })
})
