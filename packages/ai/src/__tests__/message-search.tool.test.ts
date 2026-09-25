import { describe, it, expect, vi } from 'vitest'
import { deriveLegacyVaultId, formatRecallTimestamp } from '@baishou/shared'
import { MessageSearchTool } from '../tools/message-search.tool'
import type { ToolContext } from '../tools/agent.tool'

describe('MessageSearchTool', () => {
  const tool = new MessageSearchTool()

  it('renders results with local timestamp in output (not UTC date)', async () => {
    const createdAt = new Date(2025, 5, 21, 1, 30)
    const localTs = formatRecallTimestamp(createdAt)
    const searcher = {
      searchMessages: vi.fn().mockResolvedValue([
        {
          role: 'user',
          snippet: '做了个噩梦，气醒了',
          sessionTitle: '6月17日更新后',
          date: localTs
        }
      ])
    }

    const output = await tool.execute({ query: '噩梦' }, {
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('/tmp'),
      vaultName: '/tmp',
      messageSearcher: searcher
    } as ToolContext)

    expect(searcher.searchMessages).toHaveBeenCalledWith('噩梦', 10, deriveLegacyVaultId('/tmp'), {
      startDate: undefined,
      endDate: undefined
    })
    expect(output).toContain(`会话「6月17日更新后」(${localTs})`)
    expect(output).toContain('2025-06-21 01:30')
    expect(output).not.toMatch(/\(2025-06-20\)/)
  })

  it('fail-closed when context.vaultId is missing', async () => {
    const searcher = { searchMessages: vi.fn().mockResolvedValue([{ role: 'user', snippet: 'x' }]) }
    const output = await tool.execute({ query: 'x' }, {
      sessionId: 's1',
      vaultId: '',
      vaultName: '/tmp',
      messageSearcher: searcher
    } as ToolContext)
    expect(output).toContain('缺少工作空间')
    expect(searcher.searchMessages).not.toHaveBeenCalled()
  })

  it('returns error when query is empty', async () => {
    const output = await tool.execute({ query: '   ' }, {
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('/tmp'),
      vaultName: '/tmp',
      messageSearcher: {} as any
    } as ToolContext)
    expect(output).toContain('Error')
    expect(output).toContain('start_date')
  })

  it('should list original messages when query is empty and dates are present', async () => {
    const lister = vi.fn().mockResolvedValue([
      {
        role: 'user',
        snippet: '区间内原文',
        sessionTitle: '日期会话',
        date: '2026-09-03 10:00'
      }
    ])
    const output = await tool.execute(
      { query: '', start_date: '2026-09-01', end_date: '2026-09-07' },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: vi.fn(), listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(lister).toHaveBeenCalledWith(deriveLegacyVaultId('/tmp'), 21, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    expect(output).toContain('2026-09-01 ~ 2026-09-07 的历史消息')
    expect(output).toContain('区间内原文')
  })

  it('should require both dates when listing without a keyword', async () => {
    const lister = vi.fn()
    const output = await tool.execute(
      { start_date: '2026-09-01' },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: vi.fn(), listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(output).toContain('start_date')
    expect(output).toContain('end_date')
    expect(lister).not.toHaveBeenCalled()
  })

  it('should forward session_id when listing or searching', async () => {
    const lister = vi.fn().mockResolvedValue([])
    const searcher = vi.fn().mockResolvedValue([])
    await tool.execute(
      {
        start_date: '2026-09-01',
        end_date: '2026-09-07',
        session_id: 'sess-date'
      },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: searcher, listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(lister).toHaveBeenCalledWith(deriveLegacyVaultId('/tmp'), 21, {
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      sessionId: 'sess-date'
    })

    await tool.execute(
      { query: '原文', session_id: 'sess-date' },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: searcher, listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(searcher).toHaveBeenCalledWith('原文', 10, deriveLegacyVaultId('/tmp'), {
      startDate: undefined,
      endDate: undefined,
      sessionId: 'sess-date'
    })
  })

  it('should request one extra message when the display limit is 50', async () => {
    const lister = vi.fn().mockResolvedValue([])
    await tool.execute(
      { start_date: '2026-09-01', end_date: '2026-09-07', limit: 50 },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: vi.fn(), listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(lister).toHaveBeenCalledWith(deriveLegacyVaultId('/tmp'), 51, {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
  })

  it('should reject inverted dates before listing', async () => {
    const lister = vi.fn()
    const output = await tool.execute(
      { start_date: '2026-09-07', end_date: '2026-09-01' },
      {
        sessionId: 's1',
        vaultId: deriveLegacyVaultId('/tmp'),
        vaultName: '/tmp',
        messageSearcher: { searchMessages: vi.fn(), listMessagesInDateRange: lister }
      } as ToolContext
    )
    expect(output).toContain('不能晚于')
    expect(lister).not.toHaveBeenCalled()
  })

  it('returns empty message when no hits', async () => {
    const output = await tool.execute({ query: '不存在的关键词' }, {
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('/tmp'),
      vaultName: '/tmp',
      messageSearcher: { searchMessages: vi.fn().mockResolvedValue([]) }
    } as ToolContext)
    expect(output).toContain('未找到')
  })

  it('forwards local calendar date range to the searcher', async () => {
    const searcher = { searchMessages: vi.fn().mockResolvedValue([]) }
    await tool.execute({ query: '原文', start_date: '2026-09-01', end_date: '2026-09-07' }, {
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('/tmp'),
      vaultName: '/tmp',
      messageSearcher: searcher
    } as ToolContext)
    expect(searcher.searchMessages).toHaveBeenCalledWith('原文', 10, deriveLegacyVaultId('/tmp'), {
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
  })
})
