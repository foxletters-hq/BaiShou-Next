import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStreamError } from '../useStreamError'

const showErrorMock = vi.fn()

vi.mock('@baishou/ui', () => ({
  toast: {
    showError: (...args: unknown[]) => showErrorMock(...args)
  }
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback: string) => fallback
    })
  }
})

describe('useStreamError (desktop)', () => {
  beforeEach(() => {
    showErrorMock.mockReset()
  })

  it('shows gentle content filter message even when error mentions image', () => {
    renderHook(() => useStreamError('Response blocked due to IMAGE_SAFETY', false))
    expect(showErrorMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock).toHaveBeenCalledWith(
      '回复生成失败: 伙伴被服务商安全机制拦截了呀~不是白守的错哦'
    )
  })
})
