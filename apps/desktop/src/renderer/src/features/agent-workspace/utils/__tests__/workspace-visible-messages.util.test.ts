import { describe, expect, it } from 'vitest'
import { visibleWorkspaceMessages } from '../workspace-visible-messages.util'

const inProgress = {
  id: 'a1',
  role: 'assistant',
  parts: [{ type: 'text', data: { text: '', streamStatus: 'in_progress' } }]
}

describe('visibleWorkspaceMessages', () => {
  it('should drop an interrupted thinking turn once a later assistant reply exists', () => {
    const visible = visibleWorkspaceMessages(
      [
        { id: 'u1', role: 'user' },
        { ...inProgress, id: 'old-think' },
        { id: 'a2', role: 'assistant', content: '新回复' }
      ],
      { hideTailInProgress: false }
    )
    expect(visible.map((message) => message.id)).toEqual(['u1', 'a2'])
  })

  it('should hide the tail in-progress turn while a new stream is showing', () => {
    const visible = visibleWorkspaceMessages(
      [{ id: 'u1', role: 'user' }, inProgress],
      { hideTailInProgress: true }
    )
    expect(visible.map((message) => message.id)).toEqual(['u1'])
  })

  it('should keep a real stopped turn when nothing is streaming after it', () => {
    const visible = visibleWorkspaceMessages(
      [{ id: 'u1', role: 'user' }, inProgress],
      { hideTailInProgress: false }
    )
    expect(visible.map((message) => message.id)).toEqual(['u1', 'a1'])
  })
})