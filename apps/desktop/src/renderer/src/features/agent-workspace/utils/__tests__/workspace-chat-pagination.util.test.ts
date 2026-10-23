import { describe, expect, it } from 'vitest'
import {
  applyWorkspaceCacheToRoundWindow,
  computeInitialRoundWindowStart,
  groupMessagesIntoRounds,
  prependOlderWorkspaceMessages,
  WORKSPACE_MESSAGE_PAGE_SIZE,
  WORKSPACE_ROUNDS_PER_PAGE,
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

describe('applyWorkspaceCacheToRoundWindow', () => {
  it('工作台按每页 6 轮切片，初始只展示最后 6 轮且标记 hasMore = true', () => {
    const cache = Array.from({ length: 20 }, (_, i) => ({
      id: `m-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant'
    }))
    const rounds = groupMessagesIntoRounds(cache)
    expect(rounds).toHaveLength(10)

    const initialStart = computeInitialRoundWindowStart(rounds.length)
    expect(initialStart).toBe(10 - WORKSPACE_ROUNDS_PER_PAGE)

    const result = applyWorkspaceCacheToRoundWindow(cache, initialStart, false)
    expect(result.display.map((m) => m.id)).toEqual([
      'm-8',
      'm-9',
      'm-10',
      'm-11',
      'm-12',
      'm-13',
      'm-14',
      'm-15',
      'm-16',
      'm-17',
      'm-18',
      'm-19'
    ])
    expect(result.hasMore).toBe(true)
    expect(result.roundWindowStart).toBe(4)
  })

  it('当数据库仍有更早消息且首轮为缺失 user 的半轮时，自动隐藏首部半轮', () => {
    const cache = [
      { id: 'orphan-a', role: 'assistant' },
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' }
    ]
    const result = applyWorkspaceCacheToRoundWindow(cache, 0, true)
    expect(result.display.map((m) => m.id)).toEqual(['u1', 'a1'])
    expect(result.roundWindowStart).toBe(1)
    expect(result.hasMore).toBe(true)
  })
})
