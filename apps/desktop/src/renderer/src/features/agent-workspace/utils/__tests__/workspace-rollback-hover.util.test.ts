import { describe, expect, it } from 'vitest'
import {
  resolveLastWorkspaceUserMessageId,
  resolveWorkspaceRoundUserMessageId,
  shouldStartWorkspaceBubbleEdit
} from '../workspace-rollback-hover.util'

const messages = [
  { id: 'u1', role: 'user' },
  { id: 'a1', role: 'assistant' },
  { id: 'u2', role: 'user' },
  { id: 'a2', role: 'assistant' }
]

describe('resolveWorkspaceRoundUserMessageId', () => {
  it('returns the hovered user message id', () => {
    expect(resolveWorkspaceRoundUserMessageId(messages, 'u2')).toBe('u2')
  })

  it('maps an assistant message to the preceding user round', () => {
    expect(resolveWorkspaceRoundUserMessageId(messages, 'a1')).toBe('u1')
    expect(resolveWorkspaceRoundUserMessageId(messages, 'a2')).toBe('u2')
  })

  it('returns null when the hovered id is missing', () => {
    expect(resolveWorkspaceRoundUserMessageId(messages, 'missing')).toBeNull()
    expect(resolveWorkspaceRoundUserMessageId(messages, null)).toBeNull()
  })
})

describe('resolveLastWorkspaceUserMessageId', () => {
  it('returns the latest user message', () => {
    expect(resolveLastWorkspaceUserMessageId(messages)).toBe('u2')
  })

  it('returns null when there is no user message', () => {
    expect(resolveLastWorkspaceUserMessageId([{ id: 'a1', role: 'assistant' }])).toBeNull()
    expect(resolveLastWorkspaceUserMessageId([])).toBeNull()
  })
})

describe('shouldStartWorkspaceBubbleEdit', () => {
  it('allows a plain click on the bubble', () => {
    expect(
      shouldStartWorkspaceBubbleEdit({
        defaultPrevented: false,
        target: document.createElement('div'),
        hasNonCollapsedSelection: false
      })
    ).toBe(true)
  })

  it('ignores clicks on nested buttons and existing selections', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    expect(
      shouldStartWorkspaceBubbleEdit({
        defaultPrevented: false,
        target: button,
        hasNonCollapsedSelection: false
      })
    ).toBe(false)
    expect(
      shouldStartWorkspaceBubbleEdit({
        defaultPrevented: false,
        target: document.createElement('div'),
        hasNonCollapsedSelection: true
      })
    ).toBe(false)
    button.remove()
  })
})
