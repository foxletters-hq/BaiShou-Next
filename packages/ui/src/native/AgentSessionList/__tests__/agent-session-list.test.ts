import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  flattenGroupedSessions,
  getTimeGroup,
  groupSessionsByTime
} from '../agent-session-list.utils'
import type { AgentSession } from '../agent-session-list.types'

const here = dirname(fileURLToPath(import.meta.url))
const listTsx = readFileSync(join(here, '../AgentSessionList.tsx'), 'utf8')
const itemTsx = readFileSync(join(here, '../AgentSessionListItem.tsx'), 'utf8')

describe('agent-session-list.utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('将近 7 天会话稳定归入 thisWeek（即使当天为周日也不会退化为 0 天）', () => {
    vi.useFakeTimers()
    // 2026-10-25 是周日（getDay() === 0）
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'))

    const threeDaysAgo = new Date('2026-10-22T10:00:00.000Z').getTime()
    const tenDaysAgo = new Date('2026-10-14T10:00:00.000Z').getTime()

    expect(getTimeGroup(threeDaysAgo, false)).toBe('thisWeek')
    expect(getTimeGroup(tenDaysAgo, false)).toBe('earlier')
  })

  it('将分组会话扁平化为 header + session 行列表，供 FlatList 逐项虚拟化', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'))

    const sessions: AgentSession[] = [
      {
        id: 's-pinned',
        title: '置顶会话',
        lastMessageAt: new Date('2026-10-10T10:00:00.000Z').getTime(),
        isPinned: true,
        messageCount: 2,
        snippet: '置顶摘要'
      },
      {
        id: 's-older-1',
        title: '更早会话 1',
        lastMessageAt: new Date('2026-10-05T10:00:00.000Z').getTime(),
        isPinned: false,
        messageCount: 3
      },
      {
        id: 's-older-2',
        title: '更早会话 2',
        lastMessageAt: new Date('2026-10-01T10:00:00.000Z').getTime(),
        isPinned: false,
        messageCount: 1
      }
    ]

    const grouped = groupSessionsByTime(sessions, (g) => g)
    const rows = flattenGroupedSessions(grouped)

    expect(rows.map((r) => r.key)).toEqual([
      'header:pinned',
      'session:s-pinned',
      'header:earlier',
      'session:s-older-1',
      'session:s-older-2'
    ])
  })
})

describe('Native AgentSessionList & AgentSessionListItem chrome', () => {
  it('使用扁平化行渲染 FlatList、支持受控搜索、下拉刷新与底部加载更多按钮', () => {
    expect(listTsx).toContain('flattenGroupedSessions(groupedSessions)')
    expect(listTsx).toContain('data={flatRows}')
    expect(listTsx).toContain('refreshing={isRefreshing}')
    expect(listTsx).toContain('onRefresh={onRefresh}')
    expect(listTsx).toContain('if (isControlledSearch || !searchQuery.trim()) return sessions')
    expect(listTsx).toContain("t('agent.sessions.loadMore', '加载更多对话')")
    expect(listTsx).toContain('onScroll={handleScrollNearBottom}')
    expect(listTsx).toContain('onScrollEndDrag={handleScrollNearBottom}')
    expect(listTsx).not.toContain('endReachedLockRef')
  })

  it('在会话项中展示消息预览摘要（snippet）以区分同名或分支对话', () => {
    expect(itemTsx).toContain('item.snippet')
    expect(itemTsx).toContain('styles.itemSnippet')
  })
})
