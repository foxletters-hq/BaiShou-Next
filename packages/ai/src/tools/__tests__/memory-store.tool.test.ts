import { describe, it, expect, vi } from 'vitest'
import { MEMORY_SOURCE_TYPE } from '@baishou/shared'
import { MemoryStoreTool } from '../memory-store.tool'
import type { ToolContext } from '../agent.tool'

function mockRawManager() {
  return {
    writeRecord: vi.fn().mockResolvedValue({
      shardPath: '/tmp/Memory/2026-07.jsonl',
      relativePath: '2026-07.jsonl',
      contentHash: 'abc'
    }),
    tombstone: vi.fn().mockResolvedValue(undefined),
    getMemoryManager: () => ({
      commitIndexed: vi.fn().mockResolvedValue(undefined)
    })
  }
}

describe('MemoryStoreTool', () => {
  it('should intercept and return skipped message if deduplicationService returns "skipped"', async () => {
    const tool = new MemoryStoreTool()
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({
        action: 'skipped',
        highestSimilarity: 0.95,
        removedIds: []
      })
    }

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: { isConfigured: true } as any,
      deduplicationService: mockDedup as any,
      rawDataSourceManager: mockRawManager() as any
    }

    const result = await tool.execute({ content: 'Test deduplication' }, context)

    expect(mockDedup.checkAndMerge).toHaveBeenCalledWith({
      newMemoryContent: 'Test deduplication',
      sessionId: 'sess-1'
    })
    expect(result).toContain('[MemoryDeduplication Intercept]')
    expect(result).toContain('0.950')
  })

  it('should write JSONL then embed when deduplicationService returns "merged"', async () => {
    const tool = new MemoryStoreTool()
    const raw = mockRawManager()
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({
        action: 'merged',
        mergedContent: 'Merged content!',
        removedIds: ['old-id'],
        highestSimilarity: 0.85
      })
    }
    const mockEmbedService = {
      isConfigured: true,
      embedText: vi.fn().mockResolvedValue(undefined)
    }
    const vectorStore = {
      deleteBySource: vi.fn().mockResolvedValue(undefined)
    }

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: mockEmbedService as any,
      deduplicationService: mockDedup as any,
      rawDataSourceManager: raw as any,
      vectorStore: vectorStore as any
    }

    const result = await tool.execute({ content: 'Test merge' }, context)

    expect(raw.tombstone).toHaveBeenCalledWith('memory', 'old-id', {})
    expect(raw.writeRecord).toHaveBeenCalledWith(
      'memory',
      expect.objectContaining({ content: 'Merged content!' })
    )
    expect(mockEmbedService.embedText).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Merged content!', sourceType: MEMORY_SOURCE_TYPE })
    )
    expect(result).toContain('记忆已成功存储并建立向量索引')
  })

  it('should store normally when deduplicationService returns "stored"', async () => {
    const tool = new MemoryStoreTool()
    const raw = mockRawManager()
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({
        action: 'stored',
        removedIds: [],
        highestSimilarity: 0.3
      })
    }
    const mockEmbedService = {
      isConfigured: true,
      embedText: vi.fn().mockResolvedValue(undefined)
    }

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: mockEmbedService as any,
      deduplicationService: mockDedup as any,
      rawDataSourceManager: raw as any
    }

    const result = await tool.execute({ content: 'Brand new info' }, context)

    expect(mockDedup.checkAndMerge).toHaveBeenCalled()
    expect(raw.writeRecord).toHaveBeenCalledWith(
      'memory',
      expect.objectContaining({
        content: 'Brand new info',
        vaultName: 'default',
        schemaVersion: 1
      })
    )
    expect(mockEmbedService.embedText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: MEMORY_SOURCE_TYPE,
        text: 'Brand new info'
      })
    )
    expect(result).toContain('记忆已成功存储并建立向量索引')
  })

  it('should require rawDataSourceManager', async () => {
    const tool = new MemoryStoreTool()
    const mockEmbedService = {
      isConfigured: true,
      embedText: vi.fn().mockResolvedValue(undefined)
    }

    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: mockEmbedService as any
    }

    const result = await tool.execute({ content: 'Test fallback' }, context)
    expect(result).toContain('原始数据源管理器未就绪')
    expect(mockEmbedService.embedText).not.toHaveBeenCalled()
  })

  it('should reject empty content', async () => {
    const tool = new MemoryStoreTool()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default'
    }

    const result = await tool.execute({ content: '   ' }, context)
    expect(result).toContain('请提供要存储的记忆内容')
  })

  it('should reject when embedding service is not configured', async () => {
    const tool = new MemoryStoreTool()
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: { isConfigured: false } as any,
      rawDataSourceManager: mockRawManager() as any
    }

    const result = await tool.execute({ content: 'hello' }, context)
    expect(result).toContain('嵌入模型未配置')
  })
})
