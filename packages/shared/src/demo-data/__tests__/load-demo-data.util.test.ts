import { describe, expect, it, vi } from 'vitest'
import {
  buildDemoVaultName,
  loadDemoDiaries,
  runCreateDemoVaultWorkflow,
  resolveDemoDiaryDate,
  resolveDemoSummaryDates
} from '../load-demo-data.util'
import { SummaryType } from '../../types/summary.types'

describe('load-demo-data.util', () => {
  it('resolveDemoDiaryDate respects fixed date and offsets', () => {
    const ref = new Date('2026-06-29T12:00:00')
    expect(
      resolveDemoDiaryDate({ content: 'x', dateFixed: '2025-12-31T20:40:00' }, ref).toISOString()
    ).toContain('2025-12-31')
    const offset = resolveDemoDiaryDate({ content: 'x', dateDaysOffset: -2 }, ref)
    expect(offset.getDate()).toBe(27)
  })

  it('loadDemoDiaries creates and appends on same day', async () => {
    const create = vi.fn()
    const update = vi.fn()
    const findByDate = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, content: '已有', tags: '旧' })

    await loadDemoDiaries(
      { findByDate, create, update },
      [
        { content: '第一条', dateDaysOffset: 0, tags: ['a'] },
        { content: '第二条', dateDaysOffset: 0, tags: ['b'] }
      ],
      new Date('2026-06-29')
    )

    expect(create).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]?.[1]?.content).toContain('已有')
    expect(update.mock.calls[0]?.[1]?.content).toContain('第二条')
  })

  it('resolveDemoSummaryDates parses yyyy-MM-dd range', () => {
    const { startDate, endDate } = resolveDemoSummaryDates({
      type: SummaryType.weekly,
      startDateFixed: '2026-06-23',
      endDateFixed: '2026-06-29',
      content: 'demo'
    })
    expect(startDate.getFullYear()).toBe(2026)
    expect(endDate.getHours()).toBe(23)
  })

  it('buildDemoVaultName avoids duplicates', () => {
    expect(buildDemoVaultName([])).toBe('演示空间')
    expect(buildDemoVaultName(['演示空间'])).toBe('演示空间_2')
    expect(buildDemoVaultName(['演示空间', '演示空间_2'])).toBe('演示空间_3')
  })

  it('runCreateDemoVaultWorkflow creates vault then writes data', async () => {
    const createVault = vi.fn()
    const activateVault = vi.fn()
    const create = vi.fn()
    const save = vi.fn()
    const findByDate = vi.fn().mockResolvedValue(null)

    const result = await runCreateDemoVaultWorkflow({
      listVaultNames: () => ['Personal'],
      createVault,
      activateVault,
      resolveWriters: async () => ({
        diaryWriter: { findByDate, create, update: vi.fn() },
        summaryWriter: { save }
      })
    })

    expect(createVault).toHaveBeenCalledWith('演示空间')
    expect(activateVault).toHaveBeenCalledWith('演示空间')
    expect(create).toHaveBeenCalled()
    expect(save).toHaveBeenCalled()
    expect(result.vaultName).toBe('演示空间')
    expect(result.diaryCount).toBeGreaterThan(0)
    expect(result.summaryCount).toBeGreaterThan(0)
  })
})
