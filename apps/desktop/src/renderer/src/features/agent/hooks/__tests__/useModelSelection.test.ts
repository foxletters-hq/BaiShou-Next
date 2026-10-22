import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useModelSelection } from '../useModelSelection'

vi.mock('@baishou/store', () => {
  const globalModels = {
    globalDialogueProviderId: 'provider-1',
    globalDialogueModelId: 'model-1'
  }
  return {
    useSettingsStore: (selector?: (state: { globalModels: typeof globalModels }) => unknown) => {
      const state = { globalModels }
      return selector ? selector(state) : state
    }
  }
})

describe('useModelSelection', () => {
  it('does not loop when currentAssistant is a new object on every render', () => {
    const { result } = renderHook(() =>
      useModelSelection({
        sessionId: 'sess-1',
        currentAssistant: { id: 'a1', providerId: 'ignored', modelId: 'ignored' }
      })
    )

    expect(result.current.currentProviderId).toBe('provider-1')
    expect(result.current.currentModelId).toBe('model-1')
    expect(result.current.modelSelectionSource).toBe('global')
  })

  it('keeps a manual model choice after the parent passes a new assistant object', async () => {
    const { result, rerender } = renderHook(
      (assistant: { id: string; providerId?: string; modelId?: string }) =>
        useModelSelection({ sessionId: 'sess-1', currentAssistant: assistant }),
      { initialProps: { id: 'a1', providerId: 'p0', modelId: 'm0' } }
    )

    await act(async () => {
      await result.current.selectDialogueModel('provider-2', 'model-2')
    })
    expect(result.current.currentProviderId).toBe('provider-2')
    expect(result.current.currentModelId).toBe('model-2')

    rerender({ id: 'a1', providerId: 'p0', modelId: 'm0' })
    expect(result.current.currentProviderId).toBe('provider-2')
    expect(result.current.currentModelId).toBe('model-2')
  })

  it('preserves manual model selection when transitioning from draft session to newly created session', async () => {
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string | undefined }) =>
        useModelSelection({ sessionId, currentAssistant: { id: 'a1' } }),
      { initialProps: { sessionId: 'new-session' } }
    )

    await act(async () => {
      await result.current.selectDialogueModel('provider-custom', 'model-custom')
    })
    expect(result.current.currentProviderId).toBe('provider-custom')
    expect(result.current.currentModelId).toBe('model-custom')

    rerender({ sessionId: 'persisted-uuid-123' })
    expect(result.current.currentProviderId).toBe('provider-custom')
    expect(result.current.currentModelId).toBe('model-custom')
  })

  it('restores session providerId and modelId from agent:get-session when switching to an existing session', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'agent:get-session') {
        return { id: 'sess-existing', providerId: 'provider-saved', modelId: 'model-saved' }
      }
      return undefined
    })
    ;(window as any).electron = { ipcRenderer: { invoke } }

    try {
      const { result } = renderHook(() =>
        useModelSelection({
          sessionId: 'sess-existing',
          currentAssistant: { id: 'a1' }
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(result.current.currentProviderId).toBe('provider-saved')
      expect(result.current.currentModelId).toBe('model-saved')
    } finally {
      delete (window as any).electron
    }
  })
})
