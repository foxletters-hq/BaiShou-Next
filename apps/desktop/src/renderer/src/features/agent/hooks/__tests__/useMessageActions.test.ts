import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMessageActions } from '../useMessageActions'

const confirmMock = vi.fn().mockResolvedValue(true)
const showInfoMock = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

vi.mock('@baishou/ui', () => ({
  useDialog: () => ({ confirm: (...args: unknown[]) => confirmMock(...args) }),
  toast: {
    showInfo: (...args: unknown[]) => showInfoMock(...args),
    showSuccess: vi.fn(),
    showError: vi.fn()
  }
}))

describe('useMessageActions', () => {
  it('uses the latest selected model even when invoked via a memoized bubble callback from an earlier render', async () => {
    const resendChat = vi.fn().mockResolvedValue(undefined)
    const editChat = vi.fn().mockResolvedValue(undefined)
    const truncateMessages = vi.fn()
    const setStreamSessionId = vi.fn()

    const messages = [
      { id: 'm-user-1', role: 'user', content: '你好' },
      { id: 'm-ai-1', role: 'assistant', content: '你好！' }
    ]

    const { result, rerender } = renderHook(
      ({ providerId, modelId, searchMode }) =>
        useMessageActions({
          t: (_k: string, fallback: string) => fallback,
          sessionId: 'sess-1',
          chat: { messages, truncateMessages, setStreamSessionId, refreshMessages: vi.fn() },
          stream: { resendChat, editChat },
          model: { currentProviderId: providerId, currentModelId: modelId },
          tts: { handleTtsReadAloud: vi.fn() },
          searchMode,
          currentAssistant: { id: 'a1', name: '白守' },
          sessions: [{ id: 'sess-1', title: '测试会话' }]
        }),
      {
        initialProps: {
          providerId: 'provider-old',
          modelId: 'model-old',
          searchMode: false
        }
      }
    )

    // 模拟已挂载的 memo 气泡持有的初次渲染回调引用
    const staleResend = result.current.handleResend
    const staleRegenerate = result.current.handleRegenerate
    const staleResendEdit = result.current.handleResendEdit

    // 用户切换了当前选择的模型与联网开关
    rerender({
      providerId: 'provider-new',
      modelId: 'model-new',
      searchMode: true
    })

    await act(async () => {
      await staleResend(messages[0])
    })
    expect(resendChat).toHaveBeenLastCalledWith(
      'sess-1',
      'm-user-1',
      true,
      'provider-new',
      'model-new'
    )

    await act(async () => {
      await staleRegenerate(messages[1])
    })
    expect(resendChat).toHaveBeenLastCalledWith(
      'sess-1',
      'm-user-1',
      true,
      'provider-new',
      'model-new'
    )

    await act(async () => {
      await staleResendEdit(messages[0], '修改后的内容')
    })
    expect(editChat).toHaveBeenLastCalledWith(
      'sess-1',
      'm-user-1',
      '修改后的内容',
      'provider-new',
      'model-new',
      undefined,
      true
    )
  })
})
