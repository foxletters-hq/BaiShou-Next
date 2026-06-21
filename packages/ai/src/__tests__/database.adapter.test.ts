import { describe, it, expect, vi } from 'vitest'
import { formatRecallTimestamp } from '@baishou/shared'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'

describe('DatabaseAdapter.searchMessages', () => {
  it('formats result date in local timezone (not UTC ISO date)', async () => {
    // 东八区 6/21 凌晨 01:30 → UTC 仍为 6/20 17:30，toISOString 会错误标为 6/20
    const createdAt = new Date('2025-06-20T17:30:00.000Z')
    const messageRepo = {
      searchMessagesByKeyword: vi.fn().mockResolvedValue([
        {
          role: 'user',
          content: '做了个噩梦',
          sessionTitle: '6月17日更新后',
          createdAt
        }
      ])
    }

    const adapter = new DatabaseAdapter({} as any, messageRepo as any, {} as any)
    const results = await adapter.searchMessages('噩梦', 10)

    expect(results).toHaveLength(1)
    // 与模型上下文 formatMessageTimestamp 一致：按本地日历日，避免凌晨消息被 UTC 标为前一天
    expect(results[0]!.date).toBe(formatRecallTimestamp(createdAt))
  })
})
