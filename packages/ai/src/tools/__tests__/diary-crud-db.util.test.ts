import { describe, it, expect, vi } from 'vitest'
import { runDiaryEditViaDb, runDiaryReadViaDb, ensureDiaryReadGuard } from '../diary-crud-db.util'
import type { ToolContext } from '../agent.tool'
import { createDiaryReadGuard } from '../diary-read-guard.util'

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: 's1',
    vaultName: 'Personal',
    diaryReadGuard: createDiaryReadGuard(),
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

describe('diary read-before-edit guard', () => {
  it('marks dates as read after diary_read', async () => {
    const context = createContext({
      diarySearcher: mockDiarySearcher({
        readByDates: vi
          .fn()
          .mockResolvedValue([{ date: '2024-03-01', content: '# Diary\n\nHello' }])
      })
    })

    await runDiaryReadViaDb({ dates: ['2024-03-01'] }, context)
    expect(context.diaryReadGuard?.hasRead('2024-03-01')).toBe(true)
  })

  it('rejects diary_edit when target date was not read in this turn', async () => {
    const editEntry = vi.fn()
    const context = createContext({
      diarySearcher: mockDiarySearcher({ editEntry })
    })

    const result = await runDiaryEditViaDb({ date: '2024-03-01', content: '追加内容' }, context)

    expect(result).toContain('diary_read is required before diary_edit')
    expect(editEntry).not.toHaveBeenCalled()
  })

  it('allows diary_edit after diary_read for the same date', async () => {
    const editEntry = vi.fn().mockResolvedValue({ ok: true as const })
    const context = createContext({
      diarySearcher: mockDiarySearcher({
        readByDates: vi
          .fn()
          .mockResolvedValue([{ date: '2024-03-01', content: '# Diary\n\nHello' }]),
        editEntry
      })
    })

    await runDiaryReadViaDb({ dates: ['2024-03-01'] }, context)
    const result = await runDiaryEditViaDb({ date: '2024-03-01', content: '追加内容' }, context)

    expect(result).toContain('Successfully modified')
    expect(editEntry).toHaveBeenCalledOnce()
  })

  it('ensureDiaryReadGuard lazily attaches a guard', () => {
    const context = createContext({ diaryReadGuard: undefined })
    const guard = ensureDiaryReadGuard(context)
    guard.markRead(['2024-01-01'])
    expect(context.diaryReadGuard?.hasRead('2024-01-01')).toBe(true)
  })
})
