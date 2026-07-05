import { describe, it, expect, vi } from 'vitest'
import { runDiaryEditViaDb, runDiaryReadViaDb } from '../diary-crud-db.util'
import type { ToolContext } from '../agent.tool'

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: 's1',
    vaultName: 'Personal',
    ...overrides
  }
}

function mockDiarySearcher(
  overrides: Partial<ToolContext['diarySearcher']> = {}
): NonNullable<ToolContext['diarySearcher']> {
  return {
    searchFTS: vi.fn().mockResolvedValue([]),
    ...overrides
  }
}

describe('diary crud db util', () => {
  it('returns diary content from diary_read', async () => {
    const context = createContext({
      diarySearcher: mockDiarySearcher({
        readByDates: vi
          .fn()
          .mockResolvedValue([{ date: '2024-03-01', content: '# Diary\n\nHello' }])
      })
    })

    const result = await runDiaryReadViaDb({ dates: ['2024-03-01'] }, context)

    expect(result).toContain('## 2024-03-01')
    expect(result).toContain('Hello')
  })

  it('allows diary_edit without a prior diary_read', async () => {
    const editEntry = vi.fn().mockResolvedValue({ ok: true as const })
    const context = createContext({
      diarySearcher: mockDiarySearcher({ editEntry })
    })

    const result = await runDiaryEditViaDb({ date: '2024-03-01', content: '追加内容' }, context)

    expect(result).toContain('Successfully appended')
    expect(editEntry).toHaveBeenCalledOnce()
  })

  it('supports diary_edit overwrite without a prior diary_read', async () => {
    const editEntry = vi.fn().mockResolvedValue({ ok: true as const })
    const context = createContext({
      diarySearcher: mockDiarySearcher({ editEntry })
    })

    const result = await runDiaryEditViaDb(
      { date: '2024-03-01', content: '全新内容', mode: 'overwrite' },
      context
    )

    expect(result).toContain('Successfully replaced')
    expect(editEntry).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'overwrite', content: '全新内容' })
    )
  })
})
