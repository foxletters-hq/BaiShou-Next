import { describe, it, expect, vi } from 'vitest'
import { deriveLegacyVaultId, formatRecallTimestamp } from '@baishou/shared'
import { MessageSearchTool } from '../tools/message-search.tool'
import type { ToolContext } from '../tools/agent.tool'

describe('MessageSearchTool', () => {
  const tool = new MessageSearchTool()

  it('renders results with local timestamp in output (not UTC date)', async () => {
    const createdAt = new Date(2026, 2, 10, 1, 30)
    const localTs = formatRecallTimestamp(createdAt)
    const searcher = {
      searchMessages: vi.fn().mockResolvedValue([
        {
          role: 'user',
          snippet: '整理了项目周报，已归档',
          sessionTitle: '版本更新记录',
          date: localTs
        }
      ])
    }

    const output = await tool.execute({ query: '周报' }, {
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('/tmp'),
      vaultName: '/tmp',
      messageSearcher: searcher
    } as ToolContext)

    expect(searcher.searchMessages).toHaveBeenCalledWith('周报', 10, deriveLegacyVaultId('/tmp'))
    expect(output).toContain(`会话「版本更新记录」(${localTs})`)
    expect(output).toContain('2026-03-10 01:30')
    expect(output).not.toMatch(/\(2026-03-09\)/)
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
})
