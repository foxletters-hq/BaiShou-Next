import { describe, expect, it } from 'vitest'
import {
  prependOlderWorkspaceMessages,
  WORKSPACE_MESSAGE_PAGE_SIZE,
  workspaceHasMoreMessages
} from '../workspace-chat-pagination.util'

describe('workspaceHasMoreMessages', () => {
  it('满页则认为还有更早消息', () => {
    expect(workspaceHasMoreMessages(WORKSPACE_MESSAGE_PAGE_SIZE)).toBe(true)
    expect(workspaceHasMoreMessages(WORKSPACE_MESSAGE_PAGE_SIZE, WORKSPACE_MESSAGE_PAGE_SIZE)).toBe(
      true
    )
  })

  it('不足一页则没有更早消息', () => {
    expect(workspaceHasMoreMessages(WORKSPACE_MESSAGE_PAGE_SIZE - 1)).toBe(false)
    expect(workspaceHasMoreMessages(0)).toBe(false)
  })
})

describe('prependOlderWorkspaceMessages', () => {
  it('把更早一页插到现有列表前面，并去掉重复 id', () => {
    const current = [{ id: 'm2' }, { id: 'm3' }]
    const older = [{ id: 'm1' }, { id: 'm2' }]
    expect(prependOlderWorkspaceMessages(current, older)).toEqual([
      { id: 'm1' },
      { id: 'm2' },
      { id: 'm3' }
    ])
  })

  it('更早一页为空时保持原列表', () => {
    const current = [{ id: 'm1' }]
    expect(prependOlderWorkspaceMessages(current, [])).toEqual([{ id: 'm1' }])
  })
})
