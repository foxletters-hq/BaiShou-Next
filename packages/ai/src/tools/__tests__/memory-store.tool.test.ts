import { describe, it, expect, vi } from 'vitest';
import { MemoryStoreTool } from '../memory-store.tool';
import type { ToolContext } from '../agent.tool';

describe('MemoryStoreTool', () => {
  it('should intercept and return skipped message if deduplicationService returns "skipped"', async () => {
    const tool = new MemoryStoreTool();
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({ 
        action: 'skipped', 
        highestSimilarity: 0.95,
        removedIds: []
      })
    };
    
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: { isConfigured: true } as any,
      deduplicationService: mockDedup as any
    };

    const result = await tool.execute({ content: 'Test deduplication' }, context);
    
    expect(mockDedup.checkAndMerge).toHaveBeenCalledWith({
      newMemoryContent: 'Test deduplication',
      sessionId: 'sess-1'
    });
    expect(result).toContain('[MemoryDeduplication Intercept]');
    expect(result).toContain('0.950');
  });

  it('should return merged success message if deduplicationService returns "merged"', async () => {
    const tool = new MemoryStoreTool();
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({ 
        action: 'merged', 
        mergedContent: 'Merged content!',
        removedIds: [],
        highestSimilarity: 0.85
      })
    };
    
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: { isConfigured: true } as any,
      deduplicationService: mockDedup as any
    };

    const result = await tool.execute({ content: 'Test merge' }, context);
    
    expect(result).toContain('记忆已被智能合并更新');
    expect(result).toContain('Merged content!');
  });

  it('should store normally when deduplicationService returns "stored"', async () => {
    const tool = new MemoryStoreTool();
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({ 
        action: 'stored', 
        removedIds: [],
        highestSimilarity: 0.3
      })
    };
    const mockEmbedService = { 
      isConfigured: true,
      embedText: vi.fn().mockResolvedValue(undefined)
    };
    
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: mockEmbedService as any,
      deduplicationService: mockDedup as any,
    };

    const result = await tool.execute({ content: 'Brand new info' }, context);
    
    expect(mockDedup.checkAndMerge).toHaveBeenCalled();
    expect(mockEmbedService.embedText).toHaveBeenCalled();
    expect(result).toContain('记忆已成功存储并建立向量索引');
  });

  it('should fallback to basic insertion if deduplicationService is not provided in context', async () => {
    const tool = new MemoryStoreTool();
    const mockEmbedService = { 
      isConfigured: true,
      embedText: vi.fn().mockResolvedValue(undefined)
    };
    
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: mockEmbedService as any
      // deduplicationService OMITTED — should use fallback path
    };

    const result = await tool.execute({ content: 'Test fallback' }, context);
    
    expect(mockEmbedService.embedText).toHaveBeenCalled();
    const callArgs = mockEmbedService.embedText.mock.calls[0][0];
    expect(callArgs.text).toBe('Test fallback');
    expect(callArgs.sourceType).toBe('chat');
    
    expect(result).toContain('记忆已成功存储并建立向量索引');
    expect(result).toContain('Test fallback');
  });

  it('should reject empty content', async () => {
    const tool = new MemoryStoreTool();
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
    };

    const result = await tool.execute({ content: '   ' }, context);
    expect(result).toContain('请提供要存储的记忆内容');
  });

  it('should reject when embedding service is not configured', async () => {
    const tool = new MemoryStoreTool();
    const context: ToolContext = {
      sessionId: 'sess-1',
      vaultName: 'default',
      embeddingService: { isConfigured: false } as any
    };

    const result = await tool.execute({ content: 'hello' }, context);
    expect(result).toContain('嵌入模型未配置');
  });
});
