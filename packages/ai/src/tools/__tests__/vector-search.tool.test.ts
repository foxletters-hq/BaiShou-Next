import { describe, expect, it, vi } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { VectorSearchTool } from '../vector-search.tool'
import type { ToolContext } from '../agent.tool'

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sessionId: 'sess-1',
    vaultId: deriveLegacyVaultId('Personal'),
    vaultName: 'Personal',
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
        endMs: new Date(2024, 2, 31).getTime() + 24 * 60 * 60 * 1000 - 1,
        vaultId: deriveLegacyVaultId('Personal')
      })
    )
    expect(searchFts).not.toHaveBeenCalled()
  })

  it('prints memory_id so callers can delete by unique key', async () => {
    const result = await tool.execute(
      { query: '主题', mode: 'vector' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: {
          searchSimilar: vi.fn().mockResolvedValue([
            {
              sourceType: 'memory',
              sourceId: 'mem-abc',
              groupId: 'memory',
              chunkText: '喜欢深色主题',
              distance: 0.1,
              createdAt: Date.parse('2026-08-01T12:00:00Z')
            }
          ]),
          deleteBySource: vi.fn()
        }
      })
    )

    expect(result).toContain('类型: memory')
    expect(result).toContain('memory_id: mem-abc')
    expect(result).toContain('喜欢深色主题')
  })

  it('should surface the embed API error instead of saying the model is not configured', async () => {
    const result = await tool.execute(
      { query: '天气' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi
            .fn()
            .mockRejectedValue(new Error('Sorry, your account balance is insufficient')),
          embedText: vi.fn()
        },
        vectorStore: { searchSimilar: vi.fn(), deleteBySource: vi.fn() }
      })
    )
    expect(result).toContain('Sorry, your account balance is insufficient')
    expect(result).not.toContain('嵌入模型未配置')
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

    const expectedFilter = {
      startMs: new Date(2024, 0, 1).getTime(),
      endMs: undefined,
      vaultId: deriveLegacyVaultId('Personal')
    }
    expect(searchSimilar).toHaveBeenCalledWith([0.5, 0.5], 20, expectedFilter)
    expect(searchFts).toHaveBeenCalledWith('旅行', 20, expectedFilter)
  })

  it('should use rag_top_k from userConfig and clamp above 200', async () => {
    const searchSimilar = vi.fn().mockResolvedValue([])

    await tool.execute(
      { query: '主题', mode: 'vector' },
      createContext({
        userConfig: { rag_top_k: 200 },
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: { searchSimilar, deleteBySource: vi.fn() }
      })
    )
    expect(searchSimilar).toHaveBeenCalledWith([0.1], 200, expect.any(Object))

    searchSimilar.mockClear()
    await tool.execute(
      { query: '主题', mode: 'vector' },
      createContext({
        userConfig: { rag_top_k: 500 },
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: { searchSimilar, deleteBySource: vi.fn() }
      })
    )
    expect(searchSimilar).toHaveBeenCalledWith([0.1], 200, expect.any(Object))
  })

  it('prints memory_id in hybrid mode and strips chunk suffix', async () => {
    const result = await tool.execute(
      { query: '香菜', mode: 'hybrid' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: {
          searchSimilar: vi.fn().mockResolvedValue([
            {
              sourceType: 'memory',
              sourceId: 'mem_coriander_123',
              groupId: 'memory',
              chunkText: '不喜欢吃香菜',
              distance: 0.1,
              createdAt: Date.parse('2026-08-01T12:00:00Z')
            }
          ]),
          searchFts: vi.fn().mockResolvedValue([
            {
              messageId: 'mem_coriander_123_chunk_0',
              sourceId: 'mem_coriander_123',
              sessionId: 'memory',
              snippet: '不喜欢吃香菜',
              createdAt: Date.parse('2026-08-01T12:00:00Z'),
              sourceType: 'memory'
            }
          ]),
          deleteBySource: vi.fn()
        }
      })
    )

    expect(result).toContain('类型: memory')
    expect(result).toContain('memory_id: mem_coriander_123')
    expect(result).not.toContain('memory_id: mem_coriander_123_chunk_0')
    expect(result).toContain('不喜欢吃香菜')
  })

  it('formats memory_id for manual source type', async () => {
    const result = await tool.execute(
      { query: '咖啡', mode: 'vector' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: {
          searchSimilar: vi.fn().mockResolvedValue([
            {
              sourceType: 'manual',
              sourceId: 'mem_manual_coffee',
              groupId: 'memory',
              chunkText: '每天喝一杯拿铁',
              distance: 0.1,
              createdAt: Date.parse('2026-08-01T12:00:00Z')
            }
          ]),
          deleteBySource: vi.fn()
        }
      })
    )

    expect(result).toContain('类型: manual')
    expect(result).toContain('memory_id: mem_manual_coffee')
    expect(result).toContain('每天喝一杯拿铁')
  })

  it('keeps keyword-only hits in hybrid mode even below the vector similarity threshold', async () => {
    const result = await tool.execute(
      { query: '工具测试 记忆 日记', mode: 'hybrid' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: {
          searchSimilar: vi.fn().mockResolvedValue([]),
          searchFts: vi.fn().mockResolvedValue([
            {
              messageId: 'mem_tools_1',
              sourceId: 'mem_tools_1',
              sessionId: 'memory',
              snippet: '工具测试记忆：今天把所有工具过了一遍',
              createdAt: Date.parse('2026-10-18T22:13:00Z'),
              sourceType: 'memory'
            }
          ]),
          deleteBySource: vi.fn()
        }
      })
    )

    expect(result).toContain('工具测试记忆')
    expect(result).toContain('[FTS]')
    expect(result).toContain('匹配方式: 关键词')
    expect(result).toContain('memory_id: mem_tools_1')
  })

  it('still filters low-similarity vector hits before merging', async () => {
    const result = await tool.execute(
      { query: '不相关的内容', mode: 'hybrid' },
      createContext({
        embeddingService: {
          isConfigured: true,
          embedQuery: vi.fn().mockResolvedValue([0.1]),
          embedText: vi.fn()
        },
        vectorStore: {
          searchSimilar: vi.fn().mockResolvedValue([
            {
              sourceType: 'chat',
              sourceId: 'msg_low',
              groupId: 'sess-1',
              chunkText: '低相似度内容',
              distance: 0.7,
              createdAt: Date.parse('2026-10-18T22:11:00Z')
            }
          ]),
          searchFts: vi.fn().mockResolvedValue([]),
          deleteBySource: vi.fn()
        }
      })
    )

    expect(result).toContain('向量相似度过滤')
    expect(result).toContain('没有找到语义相关的历史消息')
    expect(result).not.toContain('低相似度内容')
  })
})
