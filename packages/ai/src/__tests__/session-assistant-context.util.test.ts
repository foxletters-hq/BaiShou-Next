import { describe, it, expect } from 'vitest'
import { resolveSessionAssistantContext } from '../agent/session-assistant-context.util'

describe('resolveSessionAssistantContext', () => {
  it('merges work assistant disabled tools into user config', async () => {
    const result = await resolveSessionAssistantContext({
      sessionId: 's1',
      sessionRepo: {
        getSessionById: async () => ({ assistantId: 'a1' })
      },
      assistantRepo: {
        findById: async () => ({
          assistantKind: 'work',
          systemPrompt: 'Work persona'
        })
      },
      userConfig: { disabledToolIds: ['web_search'] }
    })

    expect(result.assistantKind).toBe('work')
    expect(result.effectiveSystemPrompt).toBe('Work persona')
    expect(result.mergedUserConfig.disabledToolIds).toContain('web_search')
    expect(result.mergedUserConfig.disabledToolIds).toContain('diary_read')
    expect(result.mergedUserConfig.disabledToolIds).toContain('vector_search')
  })

  it('defaults to companion when session has no assistant', async () => {
    const result = await resolveSessionAssistantContext({
      sessionId: 's1',
      sessionRepo: { getSessionById: async () => ({}) },
      userConfig: {}
    })

    expect(result.assistantKind).toBe('companion')
  })
})
