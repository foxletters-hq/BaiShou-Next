import { describe, it, expect, vi } from 'vitest'
import {
  buildWeeklyPrompt,
  buildMonthlyPrompt,
  buildQuarterlyPrompt,
  buildYearlyPrompt,
  getDefaultTemplate
} from '../summary/summary-prompt-templates'
import { SummaryType } from '@baishou/shared'

// Mock database deps
vi.mock('better-sqlite3', () => ({ default: class {} }))
vi.mock('drizzle-orm/better-sqlite3', () => ({ drizzle: () => ({}) }))

describe('SummaryPromptTemplates', () => {
  it('should replace placeholders in weekly prompt', () => {
    const result = buildWeeklyPrompt({
      year: 2026,
      month: 3,
      week: 4,
      start: '2026-03-23',
      end: '2026-03-29'
    })

    expect(result).toContain('2026')
    expect(result).toContain('3月')
    expect(result).toContain('第4周')
    expect(result).toContain('2026-03-23')
    expect(result).toContain('2026-03-29')
  })

  it('should replace placeholders in monthly prompt', () => {
    const result = buildMonthlyPrompt({
      year: 2026,
      month: 1,
      start: '2026-01-01',
      end: '2026-01-31'
    })

    expect(result).toContain('2026')
    expect(result).toContain('1月')
  })

  it('should replace placeholders in quarterly prompt', () => {
    const result = buildQuarterlyPrompt({
      year: 2026,
      quarter: 1,
      start: '2026-01-01',
      end: '2026-03-31'
    })

    expect(result).toContain('第1季度')
  })

  it('should replace placeholders in yearly prompt', () => {
    const result = buildYearlyPrompt({
      year: 2026,
      start: '2026-01-01',
      end: '2026-12-31'
    })

    expect(result).toContain('2026 年度回顾')
  })

  it('should use custom template when provided', () => {
    const custom = '自定义模板: {year}年{month}月'
    const result = buildWeeklyPrompt({
      year: 2026,
      month: 6,
      week: 1,
      start: '2026-06-01',
      end: '2026-06-07',
      customTemplate: custom
    })

    expect(result).toBe('自定义模板: 2026年6月')
  })

  it('getDefaultTemplate should return templates for all types', () => {
    expect(getDefaultTemplate(SummaryType.weekly)).toContain('周总结')
    expect(getDefaultTemplate(SummaryType.monthly)).toContain('月度总结')
    expect(getDefaultTemplate(SummaryType.quarterly)).toContain('季度总结')
    expect(getDefaultTemplate(SummaryType.yearly)).toContain('年度回顾')
  })
})

describe('SummaryGeneratorService', () => {
  it('should generate weekly summary via AsyncGenerator', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        {
          date: new Date('2026-03-24'),
          content: '今天完成了白守 Next 的核心引擎移植',
          tags: 'coding,baishou'
        }
      ])
    }

    const mockSummaryRepo = {
      getSummaries: vi.fn(async () => [])
    }

    const mockAiClient = {
      generateContent: vi.fn(async () => '# AI 生成的总结内容')
    }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4'
    }

    const outputs: string[] = []
    for await (const chunk of service.generate(target)) {
      outputs.push(chunk)
    }

    // 应该至少有 STATUS: 消息和最终内容
    expect(outputs.some((o) => o.startsWith('STATUS:'))).toBe(true)
    expect(outputs.some((o) => o.includes('AI 生成的总结内容'))).toBe(true)
    expect(mockAiClient.generateContent).toHaveBeenCalled()
  })

  it('should yield no_data status when no diaries in range', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [])
    }
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) }
    const mockAiClient = { generateContent: vi.fn(async () => '') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4'
    }

    const outputs: string[] = []
    for await (const chunk of service.generate(target)) {
      outputs.push(chunk)
    }

    expect(outputs).toContain('STATUS:no_data_error')
    // LLM 不应被调用
    expect(mockAiClient.generateContent).not.toHaveBeenCalled()
  })

  it('should include model name in status', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-03-24'), content: '一些内容', tags: '' }
      ])
    }
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) }
    const mockAiClient = { generateContent: vi.fn(async () => '结果') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4'
    }

    const outputs: string[] = []
    for await (const chunk of service.generate(target, 'claude-4')) {
      outputs.push(chunk)
    }

    expect(outputs.some((s) => s.includes('claude-4'))).toBe(true)
  })

  it('should inject shared memory and pass system prompt to ai client', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-03-24'), content: '日记内容', tags: '' }
      ])
    }
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) }
    const mockAiClient = { generateContent: vi.fn(async () => '伙伴总结') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4'
    }

    for await (const _ of service.generate(target, {
      modelId: 'partner-model',
      providerId: 'partner-provider',
      systemPrompt: '你是温暖的伙伴',
      sharedContextText: '共同回忆片段ABC'
    })) {
      // drain
    }

    expect(mockAiClient.generateContent).toHaveBeenCalledWith(
      expect.stringMatching(/共同回忆片段ABC[\s\S]*日记内容|日记内容[\s\S]*共同回忆片段ABC/),
      'partner-model',
      {
        system: '你是温暖的伙伴',
        providerId: 'partner-provider'
      }
    )
  })

  it('monthly weeklies source reads weeklies from summary repo, not diaries', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-02-10'), content: '本月日记不应被读取', tags: '' }
      ])
    }
    const mockSummaryRepo = {
      getSummaries: vi.fn(async () => [
        {
          type: SummaryType.weekly,
          startDate: new Date('2026-02-02'),
          endDate: new Date('2026-02-08'),
          content: '二月第一周周记内容'
        }
      ])
    }
    const mockAiClient = { generateContent: vi.fn(async () => '月报') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.monthly,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28T23:59:59'),
      label: '2026-02'
    }

    for await (const _ of service.generate(target, {
      modelId: 'm',
      monthlySummarySource: 'weeklies'
    })) {
      // drain
    }

    expect(mockSummaryRepo.getSummaries).toHaveBeenCalled()
    expect(mockDiaryRepo.findByDateRange).not.toHaveBeenCalled()
    expect(mockAiClient.generateContent).toHaveBeenCalledWith(
      expect.stringContaining('二月第一周周记内容'),
      'm',
      expect.any(Object)
    )
    const firstPrompt = (mockAiClient.generateContent.mock.calls as unknown as [string][])[0]?.[0]
    expect(firstPrompt).toBeDefined()
    expect(firstPrompt).not.toContain('本月日记不应被读取')
  })

  it('monthly diaries source reads weeklies and diaries together', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-02-10'), content: '二月十日日记', tags: 'life' }
      ])
    }
    const mockSummaryRepo = {
      getSummaries: vi.fn(async () => [
        {
          type: SummaryType.weekly,
          startDate: new Date('2026-02-02'),
          endDate: new Date('2026-02-08'),
          content: '二月第一周周记内容'
        }
      ])
    }
    const mockAiClient = { generateContent: vi.fn(async () => '月报') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.monthly,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28T23:59:59'),
      label: '2026-02'
    }

    for await (const _ of service.generate(target, {
      modelId: 'm',
      monthlySummarySource: 'diaries',
      systemPrompt: '默认回忆助手'
    })) {
      // drain
    }

    expect(mockDiaryRepo.findByDateRange).toHaveBeenCalled()
    expect(mockSummaryRepo.getSummaries).toHaveBeenCalled()
    const firstCall = (
      mockAiClient.generateContent.mock.calls as unknown as [string, string, object?][]
    )[0]
    expect(firstCall).toBeDefined()
    const prompt = firstCall?.[0] ?? ''
    expect(prompt).toContain('二月第一周周记内容')
    expect(prompt).toContain('二月十日日记')
    expect(mockAiClient.generateContent).toHaveBeenCalledWith(prompt, 'm', {
      system: '默认回忆助手',
      providerId: undefined
    })
  })

  it('uses custom generation template from options in the user prompt', async () => {
    const { SummaryGeneratorService } = await import('../summary/summary-generator.service')

    const mockDiaryRepo = {
      findByDateRange: vi.fn(async () => [
        { date: new Date('2026-03-24'), content: '日记', tags: '' }
      ])
    }
    const mockSummaryRepo = { getSummaries: vi.fn(async () => []) }
    const mockAiClient = { generateContent: vi.fn(async () => 'ok') }

    const service = new SummaryGeneratorService(
      mockDiaryRepo as any,
      mockSummaryRepo as any,
      mockAiClient as any
    )

    const target = {
      type: SummaryType.weekly,
      startDate: new Date('2026-03-23'),
      endDate: new Date('2026-03-29'),
      label: 'Week 4'
    }

    for await (const _ of service.generate(target, {
      modelId: 'm',
      customTemplates: { weekly: '【自定义周模板】{year}-{week}' },
      systemPrompt: '助手提示词'
    })) {
      // drain
    }

    const firstCall = (
      mockAiClient.generateContent.mock.calls as unknown as [string, string, object?][]
    )[0]
    expect(firstCall).toBeDefined()
    const prompt = firstCall?.[0] ?? ''
    expect(prompt).toContain('【自定义周模板】')
    expect(firstCall?.[2]).toEqual({
      system: '助手提示词',
      providerId: undefined
    })
  })
})
