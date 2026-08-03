import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveLegacyVaultId, MEMORY_SOURCE_TYPE } from '@baishou/shared'
import { MemoryDeleteTool } from '../memory-delete.tool'
import type { ToolContext } from '../agent.tool'

describe('MemoryDeleteTool', () => {
  let tool: MemoryDeleteTool

  beforeEach(() => {
    tool = new MemoryDeleteTool()
  })

  it('tombstones JSONL when deleting sourceType=memory hits', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      embeddingService: {
        isConfigured: true,
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
        embedText: vi.fn()
      },
      vectorStore: {
        searchSimilar: vi.fn().mockResolvedValue([
          {
            sourceType: MEMORY_SOURCE_TYPE,
            sourceId: 'mem-1',
            groupId: 'memory',
            chunkText: 'user likes dark theme',
            distance: 0.1,
            createdAt: Date.parse('2026-08-01T12:00:00Z')
          }
        ]),
        deleteBySource
      },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ query: 'dark theme' }, context)

    expect(result).toContain('Deleted 1')
    expect(tombstone).toHaveBeenCalledWith(
      'memory',
      'mem-1',
      expect.objectContaining({ shardMonth: expect.stringMatching(/^\d{4}-\d{2}$/) })
    )
    expect(deleteBySource).toHaveBeenCalledWith(MEMORY_SOURCE_TYPE, 'mem-1')
  })

  it('does not tombstone chat embeddings when deleting by message_id', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      vectorStore: { searchSimilar: vi.fn(), deleteBySource },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ query: 'ignored', message_id: 'msg-9' }, context)

    expect(result).toContain('msg-9')
    expect(deleteBySource).toHaveBeenCalledWith('chat', 'msg-9')
    expect(tombstone).not.toHaveBeenCalled()
  })

  it('does not tombstone chat hits from semantic search', async () => {
    const tombstone = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      embeddingService: {
        isConfigured: true,
        embedQuery: vi.fn().mockResolvedValue([0.1]),
        embedText: vi.fn()
      },
      vectorStore: {
        searchSimilar: vi.fn().mockResolvedValue([
          {
            sourceType: 'chat',
            sourceId: 'msg-2',
            groupId: 'session-1',
            chunkText: 'chat snippet',
            distance: 0.2
          }
        ]),
        deleteBySource
      },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    await tool.execute({ query: 'chat' }, context)

    expect(tombstone).not.toHaveBeenCalled()
    expect(deleteBySource).toHaveBeenCalledWith('chat', 'msg-2')
  })

  it('fail-closed: tombstone IO failure does not delete vectors', async () => {
    const tombstone = vi.fn().mockRejectedValue(new Error('ENOSPC'))
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      embeddingService: {
        isConfigured: true,
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
        embedText: vi.fn()
      },
      vectorStore: {
        searchSimilar: vi.fn().mockResolvedValue([
          {
            sourceType: MEMORY_SOURCE_TYPE,
            sourceId: 'mem-io',
            groupId: 'memory',
            chunkText: 'should remain',
            distance: 0.05,
            createdAt: Date.parse('2026-08-01T12:00:00Z')
          }
        ]),
        deleteBySource
      },
      rawDataSourceManager: {
        writeRecord: vi.fn(),
        tombstone
      }
    }

    const result = await tool.execute({ query: 'remain' }, context)

    expect(result).toMatch(/Failed to delete|ENOSPC/)
    expect(tombstone).toHaveBeenCalled()
    expect(deleteBySource).not.toHaveBeenCalled()
  })
})
