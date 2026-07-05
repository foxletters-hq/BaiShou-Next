import { describe, it, expect, vi } from 'vitest'
import { resolveAssistantParentOrderIndex } from '../agent/agent-session-persist.utils'

describe('resolveAssistantParentOrderIndex', () => {
  it('uses user message orderIndex when resending', async () => {
    const sessionRepo = {
      getMessageById: vi.fn().mockResolvedValue({ id: 'user-1', orderIndex: 6 }),
      getMessagesBySession: vi.fn()
    }

    const orderIndex = await resolveAssistantParentOrderIndex(sessionRepo as any, 's1', {
      skipUserMessageRecording: true,
      userMessageId: 'user-1'
    })

    expect(orderIndex).toBe(6)
    expect(sessionRepo.getMessagesBySession).not.toHaveBeenCalled()
  })

  it('falls back to latest message orderIndex for normal sends', async () => {
    const sessionRepo = {
      getMessageById: vi.fn(),
      getMessagesBySession: vi.fn().mockResolvedValue([{ orderIndex: 9 }])
    }

    const orderIndex = await resolveAssistantParentOrderIndex(sessionRepo as any, 's1', {})

    expect(orderIndex).toBe(9)
  })
})
