import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useComposerDraft } from '../useComposerDraft'
import type { ComposerDraftStorage } from '../composer-draft.types'

function createMemoryStorage(): ComposerDraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value)
    },
    removeItem: async (key) => {
      data.delete(key)
    }
  }
}

describe('useComposerDraft', () => {
  it('clearDraft removes stored payload', async () => {
    const storage = createMemoryStorage()
    const setText = vi.fn()

    const { result } = renderHook(() =>
      useComposerDraft({
        draftKey: 'draft-b',
        draftStorage: storage,
        text: 'hello',
        setText
      })
    )

    await act(async () => {
      await result.current.clearDraft()
    })

    expect(storage.data.has('draft-b')).toBe(false)
  })

  it('loads draft for new key and does not keep previous session text', async () => {
    const storage = createMemoryStorage()
    await storage.setItem('session-b', JSON.stringify({ text: '会话B草稿' }))

    const setText = vi.fn()

    const { rerender } = renderHook(
      ({ draftKey }: { draftKey: string }) =>
        useComposerDraft({
          draftKey,
          draftStorage: storage,
          text: '',
          setText
        }),
      { initialProps: { draftKey: 'session-a' } }
    )

    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('')
    })

    setText.mockClear()
    rerender({ draftKey: 'session-b' })

    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('')
      expect(setText).toHaveBeenCalledWith('会话B草稿')
    })
  })

  it('does not clear text when draftSyncSuspended lifts with the same key', async () => {
    const storage = createMemoryStorage()
    await storage.setItem('session-a', JSON.stringify({ text: 'stored' }))

    const setText = vi.fn()

    const { rerender } = renderHook(
      ({ draftSyncSuspended }: { draftSyncSuspended: boolean }) =>
        useComposerDraft({
          draftKey: 'session-a',
          draftStorage: storage,
          text: '用户正在输入',
          setText,
          draftSyncSuspended
        }),
      { initialProps: { draftSyncSuspended: false } }
    )

    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('stored')
    })

    setText.mockClear()
    rerender({ draftSyncSuspended: true })
    rerender({ draftSyncSuspended: false })

    await waitFor(() => {
      expect(setText).not.toHaveBeenCalled()
    })
  })

  it('defers draft load while draftSyncSuspended and applies after key change', async () => {
    const storage = createMemoryStorage()
    await storage.setItem('session-b', JSON.stringify({ text: '会话B' }))

    const setText = vi.fn()

    const { rerender } = renderHook(
      ({
        draftKey,
        draftSyncSuspended
      }: {
        draftKey: string
        draftSyncSuspended: boolean
      }) =>
        useComposerDraft({
          draftKey,
          draftStorage: storage,
          text: '发送中内容',
          setText,
          draftSyncSuspended
        }),
      { initialProps: { draftKey: 'session-a', draftSyncSuspended: true } }
    )

    setText.mockClear()
    rerender({ draftKey: 'session-b', draftSyncSuspended: true })
    expect(setText).not.toHaveBeenCalled()

    rerender({ draftKey: 'session-b', draftSyncSuspended: false })

    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('')
      expect(setText).toHaveBeenCalledWith('会话B')
    })
  })
})
