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
})
