import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
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
})
