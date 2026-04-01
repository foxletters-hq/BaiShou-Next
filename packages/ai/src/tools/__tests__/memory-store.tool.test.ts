import { describe, it, expect, vi } from 'vitest';
import { MemoryStoreTool } from '../memory-store.tool';
import { AgentTool } from '../agent.tool';
import { ToolContext } from '../agent.tool';

describe('MemoryStoreTool', () => {
  it('should intercept and return skipped message if deduplicationService returns "skipped"', async () => {
    const tool = new MemoryStoreTool();
    const mockDedup = {
      checkAndMerge: vi.fn().mockResolvedValue({ 
        action: 'skipped', 
        highestSimilarity: 0.95 
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
        mergedContent: 'Merged content!' 
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
      // deduplicationService OMITTED
    };

    const result = await tool.execute({ content: 'Test fallback' }, context);
    
    expect(mockEmbedService.embedText).toHaveBeenCalled();
    const callArgs = mockEmbedService.embedText.mock.calls[0][0];
    expect(callArgs.text).toBe('Test fallback');
    expect(callArgs.sourceType).toBe('chat');
    
    expect(result).toContain('记忆已成功存储并建立向量索引');
    expect(result).toContain('Test fallback');
  });
});
