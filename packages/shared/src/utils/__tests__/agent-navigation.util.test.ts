import { describe, expect, it } from 'vitest'
import {
  buildAgentChatNavigationPath,
  resolveCompanionReturnPath
} from '../agent-navigation.util'

describe('resolveCompanionReturnPath', () => {
  it('opens last session when restore is on', () => {
    expect(
      resolveCompanionReturnPath({
        restoreLastSessionOnReturn: true,
        snapshot: { assistantId: 'a1', sessionId: 's1' }
      })
    ).toBe(buildAgentChatNavigationPath({ assistantId: 'a1', sessionId: 's1' }))
  })

  it('keeps assistant but drops session when restore is off', () => {
    expect(
      resolveCompanionReturnPath({
        restoreLastSessionOnReturn: false,
        snapshot: { assistantId: 'a1', sessionId: 's1' }
      })
    ).toBe('/chat?assistantId=a1')
  })

  it('falls back to /chat when snapshot is empty', () => {
    expect(
      resolveCompanionReturnPath({
        restoreLastSessionOnReturn: true,
        snapshot: null
      })
    ).toBe('/chat')
  })
})
