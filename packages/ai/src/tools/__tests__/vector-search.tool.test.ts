import { describe, expect, it, vi } from 'vitest'
import { VectorSearchTool } from '../vector-search.tool'
import type { ToolContext } from '../agent.tool'

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: 'sess-1',
    userConfig: {},
    ...overrides
  } as ToolContext
}

describe('VectorSearchTool', () => {
  const tool = new VectorSearchTool()

  it('rejects invalid start_date before embedding', async () => {
    const embedQuery = vi.fn()
    const result = await tool.execute(
      { query: '旅行', start_date: 'not-a-date' },
      createContext({
        embeddingService: { isConfigured: true, embedQuery, embedText: vi.fn() },
        vectorStore: { searchSimilar: vi.fn(), deleteBySource: vi.fn() }
      })
    )

    expect(result).toContain('无效的开始日期')
    expect(embedQuery).not.toHaveBeenCalled()
  })

  it('passes time filter to vector store before semantic ranking', async () => {
    const marchMs = new Date(2024, 2, 15).getTime()
    const searchSimilar = vi.fn().mockResolvedValue([
      {
        sourceType: 'diary',
        sourceId: 'd1',
        groupId: 'g1',
        chunkText: '三月旅行',
        distance: 0.1,
        createdAt: marchMs
      }
    ])
    const searchFts = vi.fn().mockResolvedValue([])

    await tool.execute(
      { query: '旅行', start_date: '2024-03-01', end_date: '2024-03-31', mode: 'vector' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
          embedText: vi.fn()
        },
        vectorStore: { searchSimilar, searchFts, deleteBySource: vi.fn() }
      })
    )

    expect(searchSimilar).toHaveBeenCalledWith(
      [0.1, 0.2],
      20,
      expect.objectContaining({
        startMs: new Date(2024, 2, 1).getTime(),
        endMs: new Date(2024, 2, 31).getTime() + 24 * 60 * 60 * 1000 - 1
      })
    )
    expect(searchFts).not.toHaveBeenCalled()
  })

  it('passes time filter to FTS in hybrid mode', async () => {
    const searchSimilar = vi.fn().mockResolvedValue([])
    const searchFts = vi.fn().mockResolvedValue([])

    await tool.execute(
      { query: '旅行', start_date: '2024-01-01', mode: 'hybrid' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.5, 0.5]),
          embedText: vi.fn()
        },
        vectorStore: { searchSimilar, searchFts, deleteBySource: vi.fn() }
      })
    )

    const expectedFilter = { startMs: new Date(2024, 0, 1).getTime(), endMs: undefined }
    expect(searchSimilar).toHaveBeenCalledWith([0.5, 0.5], 20, expectedFilter)
    expect(searchFts).toHaveBeenCalledWith('旅行', 20, expectedFilter)
  })
})
