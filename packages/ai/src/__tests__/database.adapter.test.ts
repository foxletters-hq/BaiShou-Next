import { describe, it, expect, vi } from 'vitest'
import { formatLocalDate, formatRecallTimestamp, parseDateStr } from '@baishou/shared'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn((a) => ({ type: 'desc', a }))
}))

vi.mock('@baishou/database', () => ({
  summariesTable: {
    vaultId: 'vaultId',
    type: 'type',
    startDate: 'startDate',
    endDate: 'endDate',
    content: 'content',
    generatedAt: 'generatedAt'
  }
}))

describe('DatabaseAdapter.readSummary', () => {
  it('queries by local calendar date when startDateIso is YYYY-MM-DD', async () => {
    const targetDate = parseDateStr('2025-06-21')
    const generatedAt = new Date(2025, 5, 22)
    const endDate = new Date(2025, 5, 27)
    const where = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        {
          content: '本周总结',
          generatedAt,
          endDate
        }
      ])
    })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })
    const db = { select }

    const adapter = new DatabaseAdapter({} as any, {} as any, db as any, () => 'vlt_test')
    const result = await adapter.readSummary('weekly', '2025-06-21')

    expect(select).toHaveBeenCalled()
    expect(where).toHaveBeenCalled()
    expect(result).toEqual({
      content: '本周总结',
      generatedAt: formatLocalDate(generatedAt),
      endDateIso: formatLocalDate(endDate)
    })
    expect(targetDate.getFullYear()).toBe(2025)
    expect(targetDate.getMonth()).toBe(5)
    expect(targetDate.getDate()).toBe(21)
  })

  it('returns null when vault_id is missing (fail-closed)', async () => {
    const adapter = new DatabaseAdapter({} as any, {} as any, { select: vi.fn() } as any)
    expect(await adapter.readSummary('weekly', '2025-06-21')).toBeNull()
  })
})

describe('DatabaseAdapter.searchMessages', () => {
  it('formats result date in local timezone (not UTC ISO date)', async () => {
    // 6/21 凌晨 01:30（本地构造，各时区稳定）
    const createdAt = new Date(2025, 5, 21, 1, 30)
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

    const adapter = new DatabaseAdapter({} as any, messageRepo as any, {} as any, () => 'vlt_test')
    const results = await adapter.searchMessages('噩梦', 10)

    expect(messageRepo.searchMessagesByKeyword).toHaveBeenCalledWith('噩梦', 10, 'vlt_test')
    expect(results).toHaveLength(1)
    // 与模型上下文 formatMessageTimestamp 一致：按本地日历日，避免凌晨消息被 UTC 标为前一天
    expect(results[0]!.date).toBe(formatRecallTimestamp(createdAt))
    expect(results[0]!.date).toBe('2025-06-21 01:30')
    const legacyUtcDate = createdAt.toISOString().split('T')[0]!
    if (legacyUtcDate !== '2025-06-21') {
      expect(results[0]!.date).not.toContain(legacyUtcDate)
    }
  })

  it('fail-closed: missing vaultId returns empty without querying', async () => {
    const messageRepo = {
      searchMessagesByKeyword: vi.fn().mockResolvedValue([{ role: 'user', content: 'leak' }])
    }
    const adapter = new DatabaseAdapter({} as any, messageRepo as any, {} as any)
    expect(await adapter.searchMessages('leak', 10)).toEqual([])
    expect(messageRepo.searchMessagesByKeyword).not.toHaveBeenCalled()
  })

  it('prefers explicit vaultId argument over resolver', async () => {
    const messageRepo = {
      searchMessagesByKeyword: vi.fn().mockResolvedValue([])
    }
    const adapter = new DatabaseAdapter(
      {} as any,
      messageRepo as any,
      {} as any,
      () => 'vlt_resolver'
    )
    await adapter.searchMessages('q', 5, 'vlt_explicit')
    expect(messageRepo.searchMessagesByKeyword).toHaveBeenCalledWith('q', 5, 'vlt_explicit')
  })
})

describe('DatabaseAdapter.getBySource', () => {
  it('fail-closed: missing vaultId does not query', async () => {
    const getBySource = vi.fn()
    const adapter = new DatabaseAdapter({ getBySource } as any, {} as any, {} as any)
    expect(await adapter.getBySource('memory', 'mem-1')).toBeNull()
    expect(getBySource).not.toHaveBeenCalled()
  })

  it('passes explicit vaultId to the hybrid repository', async () => {
    const getBySource = vi.fn().mockResolvedValue({
      sourceType: 'memory',
      sourceId: 'mem-1',
      chunkText: 'ok',
      createdAt: 1
    })
    const adapter = new DatabaseAdapter(
      { getBySource } as any,
      {} as any,
      {} as any,
      () => 'vlt_resolver'
    )
    await adapter.getBySource('memory', 'mem-1', 'vlt_explicit')
    expect(getBySource).toHaveBeenCalledWith('memory', 'mem-1', { vaultId: 'vlt_explicit' })
  })
})

describe('DatabaseAdapter.getAvailableSummaries', () => {
  it('formats summary ranges with local calendar dates', async () => {
    const start = new Date(2025, 5, 16)
    const end = new Date(2025, 5, 22)
    const orderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([{ start, end }])
    })
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })
    const db = { select }

    const adapter = new DatabaseAdapter({} as any, {} as any, db as any, () => 'vlt_test')
    const lines = await adapter.getAvailableSummaries('weekly', 5)

    expect(lines).toEqual([`- ${formatLocalDate(start)} ~ ${formatLocalDate(end)}`])
    expect(lines[0]).toBe('- 2025-06-16 ~ 2025-06-22')
  })
})
