import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveLegacyVaultId, MEMORY_SOURCE_TYPE } from '@baishou/shared'
import { collectMemoryDeleteIds, MemoryDeleteTool } from '../memory-delete.tool'
import type { ToolContext } from '../agent.tool'

describe('collectMemoryDeleteIds', () => {
  it('deduplicates memory_id and memory_ids', () => {
    expect(
      collectMemoryDeleteIds({
        memory_id: ' mem-1 ',
        memory_ids: ['mem-1', 'mem-2', '', 'mem-2']
      })
    ).toEqual(['mem-1', 'mem-2'])
  })
})

describe('MemoryDeleteTool', () => {
  let tool: MemoryDeleteTool

  beforeEach(() => {
    tool = new MemoryDeleteTool()
  })

  it('rejects calls without a unique memory id and does not search', async () => {
    const searchSimilar = vi.fn()
    const deleteBySource = vi.fn()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      embeddingService: {
        isConfigured: true,
        embedQuery: vi.fn(),
        embedText: vi.fn()
      },
      vectorStore: { searchSimilar, deleteBySource }
    }

    const result = await tool.execute({}, context)

    expect(result).toMatch(/缺少记忆唯一键|memory_id/)
    expect(searchSimilar).not.toHaveBeenCalled()
    expect(deleteBySource).not.toHaveBeenCalled()
  })

  it('tombstones JSONL and deletes only the requested memory id', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const getBySource = vi.fn().mockResolvedValue({
      sourceType: MEMORY_SOURCE_TYPE,
      sourceId: 'mem-1',
      chunkText: 'user likes dark theme',
      createdAt: Date.parse('2026-08-01T12:00:00Z')
    })
    const searchSimilar = vi.fn()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: {
        searchSimilar,
        deleteBySource,
        getBySource
      },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ memory_id: 'mem-1' }, context)

    expect(result).toContain('已按唯一键删除 1')
    expect(result).toContain('mem-1')
    expect(searchSimilar).not.toHaveBeenCalled()
    expect(getBySource).toHaveBeenCalledWith(
      MEMORY_SOURCE_TYPE,
      'mem-1',
      deriveLegacyVaultId('Personal')
    )
    expect(tombstone).toHaveBeenCalledWith(
      'memory',
      'mem-1',
      expect.objectContaining({ shardMonth: expect.stringMatching(/^\d{4}-\d{2}$/) })
    )
    expect(deleteBySource).toHaveBeenCalledTimes(1)
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'mem-1')
  })

  it('skips unknown ids without deleting other memories', async () => {
    const tombstone = vi
      .fn()
      .mockRejectedValue(new Error('Memory tombstone: id not found: missing'))
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const getBySource = vi.fn().mockResolvedValue(null)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource, getBySource },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ memory_id: 'missing' }, context)

    expect(result).toMatch(/没有删除任何记忆|未找到/)
    expect(deleteBySource).not.toHaveBeenCalled()
  })

  it('deletes multiple exact ids without semantic search', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const getBySource = vi.fn().mockImplementation(async (_type: string, sourceId: string) => ({
      sourceType: MEMORY_SOURCE_TYPE,
      sourceId,
      chunkText: sourceId,
      createdAt: Date.parse('2026-08-01T12:00:00Z')
    }))
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource, getBySource },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ memory_ids: ['a', 'b'] }, context)

    expect(result).toContain('已按唯一键删除 2')
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'a')
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'b')
    expect(deleteBySource).toHaveBeenCalledTimes(2)
  })

  it('fail-closed: tombstone IO failure does not delete vectors', async () => {
    const tombstone = vi.fn().mockRejectedValue(new Error('ENOSPC'))
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: {
        searchSimilar: vi.fn(),
        deleteBySource,
        getBySource: vi.fn().mockResolvedValue({
          sourceType: MEMORY_SOURCE_TYPE,
          sourceId: 'mem-io',
          chunkText: 'should remain',
          createdAt: Date.parse('2026-08-01T12:00:00Z')
        })
      },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ memory_id: 'mem-io' }, context)

    expect(result).toMatch(/Failed to delete|ENOSPC/)
    expect(tombstone).toHaveBeenCalled()
    expect(deleteBySource).not.toHaveBeenCalled()
  })

  it('rejects natural language descriptions with helpful guidance', async () => {
    const deleteBySource = vi.fn()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource }
    }

    const result = await tool.execute({ memory_id: '删除我喜欢吃香菜的记忆' }, context)

    expect(result).toContain('疑似为自然语言描述')
    expect(result).toContain('vector_search')
    expect(result).toContain('严禁向用户声称或虚构已删除该记忆')
    expect(deleteBySource).not.toHaveBeenCalled()
  })

  it('strips chunk suffix and deletes the base memory id', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const getBySource = vi.fn().mockImplementation(async (_type: string, id: string) => {
      if (id === 'mem-chunked' || id === 'mem-chunked_chunk_0') {
        return {
          sourceType: MEMORY_SOURCE_TYPE,
          sourceId: 'mem-chunked',
          chunkText: 'chunked content',
          createdAt: Date.parse('2026-08-01T12:00:00Z')
        }
      }
      return null
    })

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource, getBySource },
      rawDataSourceManager: { writeRecord: vi.fn(), tombstone }
    }

    const result = await tool.execute({ memory_id: 'mem-chunked_chunk_0' }, context)

    expect(result).toContain('已按唯一键删除 1')
    expect(result).toContain('mem-chunked')
    expect(tombstone).toHaveBeenCalledWith('memory', 'mem-chunked', expect.any(Object))
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'mem-chunked')
  })

  it('handles manual source type and cleans both manual and memory vector rows', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const getBySource = vi.fn().mockImplementation(async (type: string, id: string) => {
      if (type === 'manual' && id === 'mem-manual-1') {
        return {
          sourceType: 'manual',
          sourceId: 'mem-manual-1',
          chunkText: 'manual memory text',
          createdAt: Date.parse('2026-08-01T12:00:00Z')
        }
      }
      return null
    })

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource, getBySource },
      rawDataSourceManager: { writeRecord: vi.fn(), tombstone }
    }

    const result = await tool.execute({ memory_id: 'mem-manual-1' }, context)

    expect(result).toContain('已按唯一键删除 1')
    expect(tombstone).toHaveBeenCalledWith('memory', 'mem-manual-1', expect.any(Object))
    // 应该删除了 manual 和 memory 两种 source_type 的向量
    expect(deleteBySource).toHaveBeenCalledWith('manual', 'mem-manual-1')
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'mem-manual-1')
  })
})
