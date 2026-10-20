import { describe, expect, it, vi } from 'vitest'
import { SummaryType } from '@baishou/shared'
import { SummaryReadTool } from '../summary-read.tool'
import { SummaryWriteTool } from '../summary-write.tool'
import type { ToolContext } from '../agent.tool'

describe('SummaryReadTool and SummaryWriteTool', () => {
  it('SummaryReadTool detects missing weekly and monthly summaries via bitmap detector', async () => {
    const tool = new SummaryReadTool()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: 'vault-1',
      vaultName: 'default',
      diarySearcher: {
        searchFTS: vi.fn(),
        listInDateRange: vi.fn().mockResolvedValue([
          { date: '2026-03-03', preview: '周二日记' },
          { date: '2026-03-10', preview: '下周二日记' }
        ])
      },
      summaryReader: {
        readSummary: vi.fn(),
        getAvailableSummaries: vi.fn(),
        listAllSummaries: vi.fn().mockResolvedValue([
          {
            type: SummaryType.weekly,
            startDate: new Date(2026, 2, 2, 0, 0, 0),
            endDate: new Date(2026, 2, 8, 23, 59, 59)
          }
        ])
      }
    }

    const output = await tool.execute({ mode: 'missing', type: 'all' }, context)

    // 2026-03-02 ~ 2026-03-08 weekly already exists, so 2026-03-09 ~ 2026-03-15 weekly and 2026-03 monthly are missing
    expect(output).toContain('2026-03-09')
    expect(output).toContain('2026-03-15')
    expect(output).toContain('2026年3月')
    expect(output).toContain('2026-03-01')
  })

  it('SummaryReadTool reads existing summary in default read mode', async () => {
    const tool = new SummaryReadTool()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: 'vault-1',
      vaultName: 'default',
      summaryReader: {
        readSummary: vi.fn().mockResolvedValue({
          content: '##### 2026年3月第10周总结\n\n本周内容',
          generatedAt: '2026-03-09',
          endDateIso: '2026-03-08'
        }),
        getAvailableSummaries: vi.fn()
      }
    }

    const output = await tool.execute(
      { mode: 'read', type: 'weekly', start_date: '2026-03-02' },
      context
    )
    expect(output).toBe('##### 2026年3月第10周总结\n\n本周内容')
  })

  it('SummaryWriteTool writes summary markdown to Summaries relativePath and upserts DB record', async () => {
    const tool = new SummaryWriteTool()
    const writeFile = vi.fn().mockResolvedValue({ contentHash: 'abc123' })
    const writeSummary = vi.fn().mockResolvedValue({ ok: true as const })

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: 'vault-1',
      vaultName: 'default',
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone: vi.fn(),
        writeFile
      },
      summaryReader: {
        readSummary: vi.fn(),
        getAvailableSummaries: vi.fn(),
        writeSummary
      }
    }

    const result = await tool.execute(
      {
        type: 'weekly',
        start_date: '2026-03-09',
        content: '  ##### 2026年3月第11周总结\n\n正文内容  '
      },
      context
    )

    expect(writeFile).toHaveBeenCalledWith(
      'summary',
      'Weekly/2026/2026-03-09.md',
      '##### 2026年3月第11周总结\n\n正文内容'
    )
    expect(writeSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SummaryType.weekly,
        content: '##### 2026年3月第11周总结\n\n正文内容'
      })
    )
    expect(result).toContain('Summaries/Weekly/2026/2026-03-09.md')
    expect(result).toContain('2026-03-09 ~ 2026-03-15')
  })
})
