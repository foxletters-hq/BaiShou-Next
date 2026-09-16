import { describe, expect, it } from 'vitest'
import { findPrecedingUserMessageId } from '../workspace-message-round.util'

function msg(id: string, role: 'user' | 'assistant') {
  return { id, role }
}

describe('findPrecedingUserMessageId', () => {
  it('should return the same id when the target is a user message', () => {
    const messages = [msg('u1', 'user'), msg('a1', 'assistant')]
    expect(findPrecedingUserMessageId(messages, 'u1')).toBe('u1')
  })

  it('should return the nearest preceding user id when the target is an assistant message', () => {
    const messages = [
      msg('u1', 'user'),
      msg('a1', 'assistant'),
      msg('u2', 'user'),
      msg('a2', 'assistant')
    ]
    expect(findPrecedingUserMessageId(messages, 'a2')).toBe('u2')
    expect(findPrecedingUserMessageId(messages, 'a1')).toBe('u1')
  })

  it('should return null when no user message exists or the id is missing', () => {
    expect(findPrecedingUserMessageId([msg('a1', 'assistant')], 'a1')).toBeNull()
    expect(findPrecedingUserMessageId([msg('u1', 'user')], 'missing')).toBeNull()
  })
})
