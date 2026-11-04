import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { DialogProvider } from '../../Dialog'
import { useAIModelServicesView } from '../useAIModelServicesView'

function wrapper({ children }: { children: React.ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>
}

describe('useAIModelServicesView', () => {
  it('should stay stable when providers stay the same after mount', () => {
    const providers = {
      openai: {
        providerId: 'openai',
        enabled: true,
        apiKey: '',
        sortOrder: 0
      }
    }

    const { result, rerender } = renderHook(
      () =>
        useAIModelServicesView({
          providers,
          onUpdateProvider: vi.fn()
        }),
      { wrapper }
    )

    const firstList = result.current.localProvidersList
    rerender()
    expect(result.current.localProvidersList).toBe(firstList)
    expect(result.current.localProvidersList.length).toBeGreaterThan(0)
  })

  it('supports creating custom provider with initial model names', () => {
    const onUpdateProvider = vi.fn()
    const providers = {
      openai: {
        providerId: 'openai',
        enabled: true,
        apiKey: '',
        sortOrder: 0
      }
    }
    const { result } = renderHook(
      () =>
        useAIModelServicesView({
          providers,
          onUpdateProvider
        }),
      { wrapper }
    )

    act(() => {
      result.current.setAddModalData({
        name: 'Custom Workers AI',
        type: 'openai',
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/xxx/ai/v1',
        modelsText: '@cf/meta/llama-3-8b-instruct, @cf/qwen/qwen1.5-7b-chat'
      })
    })

    act(() => {
      result.current.submitAddCustomProvider()
    })

    expect(onUpdateProvider).toHaveBeenCalledTimes(1)
    const [pid, updates] = onUpdateProvider.mock.calls[0]
    expect(pid).toMatch(/^custom_/)
    expect(updates).toEqual({
      name: 'Custom Workers AI',
      type: 'openai',
      apiBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/xxx/ai/v1',
      isSystem: false,
      enabled: true,
      apiKey: '',
      models: ['@cf/meta/llama-3-8b-instruct', '@cf/qwen/qwen1.5-7b-chat'],
      enabledModels: ['@cf/meta/llama-3-8b-instruct', '@cf/qwen/qwen1.5-7b-chat'],
      defaultDialogueModel: '@cf/meta/llama-3-8b-instruct'
    })
  })
})
