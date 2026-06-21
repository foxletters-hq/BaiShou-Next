import { describe, it, expect, vi } from 'vitest'
import { formatRecallTimestamp } from '@baishou/shared'
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
      vaultName: '/tmp',
      messageSearcher: searcher
    } as ToolContext)

    expect(searcher.searchMessages).toHaveBeenCalledWith('噩梦', 10)
    expect(output).toContain(`会话「6月17日更新后」(${localTs})`)
    expect(output).toContain('2025-06-21 01:30')
    expect(output).not.toMatch(/\(2025-06-20\)/)
  })

  it('returns error when query is empty', async () => {
    const output = await tool.execute({ query: '   ' }, {
      sessionId: 's1',
      vaultName: '/tmp',
      messageSearcher: {} as any
    } as ToolContext)
    expect(output).toContain('Error')
  })

  it('returns empty message when no hits', async () => {
    const output = await tool.execute({ query: '不存在的关键词' }, {
      sessionId: 's1',
      vaultName: '/tmp',
      messageSearcher: { searchMessages: vi.fn().mockResolvedValue([]) }
    } as ToolContext)
    expect(output).toContain('未找到')
  })
})
