import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { SessionListTool } from '../tools/session-list.tool'
import type { ToolContext, ToolMessageSearcher } from '../tools/agent.tool'

function ctx(
  searcher: Partial<ToolMessageSearcher>,
  vaultId: string = deriveLegacyVaultId('/tmp')
): ToolContext {
  return {
    sessionId: 's1',
    vaultId,
    vaultName: '/tmp',
    messageSearcher: {
      searchMessages: vi.fn(),
      ...searcher
    }
  } as ToolContext
}

describe('SessionListTool', () => {
  const tool = new SessionListTool()

  it('should list sessions with title, time, count and preview', async () => {
    const lister = vi.fn().mockResolvedValue([
      {
        sessionId: 'sess-travel',
        sessionTitle: '旅行计划',
        firstDate: '2026-09-03 10:00',
        lastDate: '2026-09-03 11:00',
        messageCount: 4,
        preview: '下周去哪'
      }
    ])

    const output = await tool.execute(
      { start_date: '2026-09-01', end_date: '2026-09-07' },
      ctx({ listSessionsInDateRange: lister })
    )

    expect(lister).toHaveBeenCalledWith(deriveLegacyVaultId('/tmp'), '2026-09-01', '2026-09-07', 21)
    expect(output).toContain('找到 1 个在 2026-09-01 ~ 2026-09-07 有发言的会话')
    expect(output).toContain('会话「旅行计划」（id: sess-travel，2026-09-03 10:00 ~ 2026-09-03 11:00，4 条）')
    expect(output).toContain('下周去哪')
  })

  it('should request one extra session when the display limit is 50', async () => {
    const lister = vi.fn().mockResolvedValue([])
    await tool.execute(
      { start_date: '2026-09-01', end_date: '2026-09-07', limit: 50 },
      ctx({ listSessionsInDateRange: lister })
    )
    expect(lister).toHaveBeenCalledWith(deriveLegacyVaultId('/tmp'), '2026-09-01', '2026-09-07', 51)
  })

  it('should return error when date format is invalid', async () => {
    const output = await tool.execute(
      { start_date: '09-01', end_date: '2026-09-07' },
      ctx({ listSessionsInDateRange: vi.fn() })
    )
    expect(output).toContain('YYYY-MM-DD')
  })

  it('should fail-closed when vaultId is missing', async () => {
    const lister = vi.fn()
    const output = await tool.execute(
      { start_date: '2026-09-01', end_date: '2026-09-07' },
      ctx({ listSessionsInDateRange: lister }, '')
    )
    expect(output).toContain('缺少工作空间')
    expect(lister).not.toHaveBeenCalled()
  })

  it('should mention truncation when more sessions exist than the limit', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      sessionId: `sess-${i}`,
      sessionTitle: `会话${i}`,
      firstDate: '2026-09-03 10:00',
      lastDate: '2026-09-03 10:00',
      messageCount: 1,
      preview: '预览'
    }))
    const output = await tool.execute(
      { start_date: '2026-09-01', end_date: '2026-09-07', limit: 20 },
      ctx({ listSessionsInDateRange: vi.fn().mockResolvedValue(rows) })
    )
    expect(output).toContain('仅显示最近 20 个会话')
    expect(output).not.toContain('会话20')
  })

  it('should say there are no sessions in an empty range', async () => {
    const output = await tool.execute(
      { start_date: '2026-01-01', end_date: '2026-01-02' },
      ctx({ listSessionsInDateRange: vi.fn().mockResolvedValue([]) })
    )
    expect(output).toContain('没有会话记录')
  })
})
